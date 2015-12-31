/*jshint unused: false, latedef: false */
/*jslint vars: true, plusplus: true, undef: true, continue: true */
/*global requirejs, require */

"use strict";

// -----------------------------------------------------------------------------
// Configuration settings that do not change:

/**
 * The radius around radars in km in which path anchors are considered.
 * @type {number}
 */
var radarAnchorRadius = 75;

/**
 * The migrants-per-path options.
 */
var migrantsPerPathOptions = [
  { value: 10000, text: "10K" },
  { value: 25000, text: "25K" },
  { value: 50000, text: "50K" },
  { value: 100000, text: "100K" },
  { value: 250000, text: "250K" },
  { value: 500000, text: "500K" }
];

/**
 * The height of the template map divided by its width, used to obtain the actual
 * height of the map, given the actual width after resizing.
 * @type {number}
 */
var mapHeightFactor = 940 / 720;

/**
 * The template legend width divided by the template map width, used to obtain the
 * actual width of the legend, given the actual width after resizing.
 * @type {number}
 */
var legendWidthFactor = 200 / 720;

/**
 * The minimum value of the range of hues to pick from for strata colors.
 * @type {number}
 */
var altiHueMin = 0.5;

/**
 * The maximum value of the range of hues to pick from for strata colors.
 * @type {number}
 */
var altiHueMax = 1;

/**
 * The saturation for strata colors.
 * @type {number}
 */
var altiSaturation = 1;

/**
 * The brightness for strata colors.
 * @type {number}
 */
var altiBrightness = 0.7;

/**
 * The initial focus duration, in hours.
 * @type {number}
 */
var defaultFocusDuration = 6;

/**
 * When true then only one path per radar is drawn.
 * @type {boolean}
 */
var singlePath = false;

/**
 * When true then basic metadata is provided in the visualisation.
 * @type {boolean}
 */
var writeMetaDataInViz = true;

/**
 * When true the special 'arty' mode is activated.
 * @type {boolean}
 */
var arty = false;

var showRadarLabels = true;

// -----------------------------------------------------------------------------
// System variables:

/** @type {number} */ var mapW = 0;
/** @type {number} */ var mapH = 0;
/** @type {number} */ var legendW = 0;
/** @type {number} */ var anchorArea;
/** @type {array}  */ var anchorLocations;
/** @type {Object} */ var svg;
/** @type {Object} */ var projection;
/** @type {Object} */ var projectionPath;
/** @type {Object} */ var currentData;

// -----------------------------------------------------------------------------

/**
 * Start the app. Call this function from a script element at the end of the html-doc.
 * @param _caseStudy {string} The initial case study object as initialized in the
 *                            init.js files for each case study.
 */
function startApp(caseStudy) {
  // assert that SVG is supported by the browser:
  if (!document.implementation.hasFeature("http://www.w3.org/TR/SVG11/feature#Image", "1.1")) {
    alert('SVG is not supported in your browser. Please use a recent browser.');
    return;
  }

  d3.select("#radar-anchor-radius").text(radarAnchorRadius);

  // load the case study data:
  caseStudy.load(function () {
    //console.log(caseStudy);

    // The initial focus:
    focus = enram.focus(
      caseStudy.defaultFocusFrom,
      defaultFocusDuration,
      caseStudy.defaultStrataOption,
      caseStudy.defaultMigrantsPerPath
    );
    focus.constrain(caseStudy);

    d3.select("#path-bird-count").text(numeral(focus.migrantsPerPath).format('0,0'));

    // parse the url query:
    var urlQuery = {};
    location.search.replace('\?','').split('&').map(function (nvPair) {
      nvPair = nvPair.split('=');
      urlQuery[nvPair[0]] = nvPair[1];
    });
    if (urlQuery["strata-count"]) {
      setStrataCount(parseInt(urlQuery["strata-count"]));
    }
    else if (urlQuery.altBands) {  // legacy
      setStrataCount(urlQuery.altBands);
    }
    if (urlQuery["single-path"]) {
      singlePath = urlQuery["single-path"] == "true";
    }
    if (urlQuery["length"]) {
      defaultFocusDuration = parseInt(urlQuery["length"]);
    }

    var busy = 2;

    // load the topography:
    d3.json(caseStudy.topoJsonUrl, function (error, json) {
      if (error) {
        console.error(error);
        return;
      }
      caseStudy.topoJson = json;
      if (--busy == 0) initDone(caseStudy);
    });

    //updateAnchors();
    updateColors(caseStudy, focus);

    anchorArea = caseStudy.anchorInterval * caseStudy.anchorInterval;

    if (--busy == 0) initDone(caseStudy);
  });
}

/**
 * This function assumes that seconds and milliseconds are zero.
 * @param from {moment}
 * @param focus {enram.focus}
 * @param caseStudy {enram.caseStudy}
 * @returns {moment}
 */
function constrainFrom(from, focus, caseStudy) {
  if (from.isBefore(caseStudy.dataFrom)) {
    from.date(caseStudy.dataFrom.date());
    from.hour(caseStudy.dataFrom.hour());
    from.minute(caseStudy.dataFrom.minute());
    return from;
  }
  var till = moment(from).add(focus.duration, 'hours');
  if (!till.isBefore(caseStudy.dataTill)) {
    from.date(caseStudy.dataTill.date());
    from.hour(caseStudy.dataTill.hour() - focus.duration);
    from.minute(caseStudy.dataTill.minute());
  }
  return from;
}

function initDone(caseStudy) {

  function dateUpdateHandler() {
    var inputDay = d3.select("#input-day");
    var inputHour = d3.select("#input-hour");

    // derive and constrain new focus from moment:
    var newFocusFrom = moment(focus.from);
    newFocusFrom.date(parseInt(inputDay.property('value')));
    newFocusFrom.hour(parseInt(inputHour.property('value')));
    constrainFrom(newFocusFrom, focus, caseStudy);

    // update the input widget to the constrained values:
    inputDay.property('value', newFocusFrom.date());
    inputHour.property('value', newFocusFrom.hour());
    d3.select("#focus-month").text(focus.from.format("MMM"));
    d3.select("#focus-year").text(focus.from.format("YYYY"));

    // update focus and view if focus has changed:
    if (!newFocusFrom.isSame(focus.from)) {
      focus.setFrom(newFocusFrom);
      updateVisualisation(caseStudy, focus, true, false);
    }
  }

  function durationUpdateHandler() {
    var inputDuration = d3.select("#input-length");
    var newDuration = parseInt(inputDuration.property('value'));
    if (newDuration != focus.duration) {
      focus.setDuration(newDuration);
      updateVisualisation(caseStudy, focus, true, false);
    }
  }

  function strataCountUpdateHandler() {
    var newStrataOptionIdx = d3.select("#input-strata").property('value');
    if (newStrataOptionIdx != focus.strataOptionIdx) {
      //console.log("input-strata changed:", newStrataOptionIdx);
      setStrataOptionIdx(newStrataOptionIdx);
      updateColors(caseStudy, focus);
      updateVisualisation(caseStudy, focus, true, true);
    }
  }

  function migrantsPerPathUpdateHandler() {
    var newMPP = d3.select(this).property('value');
    if (newMPP != focus.migrantsPerPath) {
      //console.log("input-migrants-per-path changed:", newMPP);
      setMigrantsPerPath(newMPP);
      updateVisualisation(caseStudy, focus, false, false);
    }
  }

  // configure the date input widgets:
  d3.select("#input-day")
    .property('value', focus.from.date())
    //.attr('min', caseStudy.dataFrom.date())
    //.attr('max', moment(caseStudy.dataTill).subtract(1, 'minute').date())
    .on('change', dateUpdateHandler);
  d3.select("#focus-month").text(focus.from.format("MMM"));
  d3.select("#focus-year").text(focus.from.format("YYYY"));
  d3.select("#input-hour")
    .property('value', focus.from.hour())
    .on('change', dateUpdateHandler);

  // configure the duration input widget:
  d3.select("#input-length")
    .property('value', focus.duration)
    .on('change', durationUpdateHandler);

  // configure the strata-count input widget:
  d3.select("#input-strata")
    .selectAll('option')
    .data(caseStudy.strataOptions)
    .enter().append("option")
    .property('value', function (strataOption, i) { return i; })
    .text(function (strataOption) { return strataOption.length; });
  d3.select("#input-strata")
    .property('value', caseStudy.defaultStrataOption)
    .on('change', strataCountUpdateHandler);

  // configure the migrants-per-path input widget:
  d3.select("#input-migrants-per-path")
    .selectAll('option')
    .data(migrantsPerPathOptions)
    .enter().append("option")
    .property("value", function (d) { return d.value; })
    //.property("selected", function(d) { return d === focus.migrantsPerPath; })
    .text(function (d) { return d.text; });
  d3.select("#input-migrants-per-path")
    .property('value', focus.migrantsPerPath)
    .on('change', migrantsPerPathUpdateHandler);

  // set resize handler that updates the visualisation:
  d3.select(window)
    .on('resize', Foundation.utils.throttle(function(e) {
      if (d3.select("#map-container").node().getBoundingClientRect().width != mapW) {
        updateVisualisation(caseStudy, focus, false, true);
      }
    }, 25));

  // First update the map data and add the svg element to avoid miscalculation
  // of the actual size of the svg content (on Chrome).
  updateMapData(caseStudy);

  // Now update the map for real:
  updateVisualisation(caseStudy, focus, true, true);
}

/**
 * Use this function to update the strata-option value.
 * @param {number} strataOptionIdx
 */
function setStrataOptionIdx(strataOptionIdx) {
  focus.strataOptionIdx = strataOptionIdx;
}

/**
 * Use this function to update the migrants-per-path value.
 * @param {number} migrantsPerPath
 */
function setMigrantsPerPath(migrantsPerPath) {
  focus.migrantsPerPath = migrantsPerPath;
  d3.select("#path-bird-count").text(numeral(migrantsPerPath).format('0,0'));
}

/**
 * Prepare the hues for the altitude strata.
 * @param caseStudy {enram.caseStudy}
 * @param focus {enram.focus}
 */
function updateColors(caseStudy, focus) {
  caseStudy.hues = [];
  caseStudy.altHexColors = [];
  var altn = focus.strataCount(caseStudy);
  var hue;
  if (altn == 1) {
    hue = (altiHueMin + altiHueMax) / 2;
    caseStudy.hues.push(hue);
    caseStudy.altHexColors.push(utils.hsvToHex(hue, altiSaturation, altiBrightness));
  }
  else {
    for (var alti = 0; alti < altn; alti++) {
      hue = utils.mapRange(alti, 0, altn - 1, altiHueMin, altiHueMax);
      caseStudy.hues.push(hue);
      caseStudy.altHexColors.push(utils.hsvToHex(hue, altiSaturation, altiBrightness));
    }
  }
}

/**
 * @param caseStudy {enram.caseStudy}
 * @param focus {enram.focus}
 * @param dataDirty {boolean}
 * @param mapDirty {boolean}
 */
function updateVisualisation(caseStudy, focus, dataDirty, mapDirty) {
  if (mapDirty) updateMapData(caseStudy);

  // create/replace svg object:
  if (svg) { svg.remove(); }
  svg = d3.select("#map-container").append("svg")
    .attr("width", mapW)
    .attr("height", mapH)
    .classed("visualisation", true);

  svg.append("defs")
    .append("clipPath")
    .attr("id", "clipRect")
    .append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", mapW)
    .attr("height", mapH);

  var clipG = svg.append("g");
  clipG.attr("style", "clip-path: url(#clipRect);");
  if (arty) {
    clipG.attr("style", "background: #fff;");
  }
  else {
    var mapG = clipG.append("g").attr("id", "map");
    drawMap(mapG, caseStudy);
  }

  var pathsG = clipG.append("g").attr("id", "paths");
  if (dataDirty) {
    // A clone of the focus is passed to the loader. This focus will be set
    // as focus property on the resulting data object.
    caseStudy.loadFocusData(focus.clone(), function (data) {
      //console.log(data);
      currentData = data;
      drawPaths(data, pathsG);
    });
  }
  else {
    currentData.focus = focus;
    drawPaths(currentData, pathsG);
  }

  if (!arty) {
    // draw legends:
    var legendG = clipG.append("g").attr("id", "color-legend");
    drawColorLegend(caseStudy, focus, legendG);

    legendG = clipG.append("g").attr("id", "scale-legend");
    drawScaleLegend(caseStudy, legendG, caseStudy.scaleLegendMarkers);

    writeMetaData(caseStudy, focus, clipG);
  }
}

function updateMapData(caseStudy) {
  var svgRect = d3.select("#map-container").node().getBoundingClientRect();
  mapW = svgRect.width;
  //console.log("- mapW:", mapW);
  mapH = mapW * mapHeightFactor;
  legendW = mapW * legendWidthFactor;

  // specify the projection based of the size of the map:
  projection = caseStudy.getProjection(caseStudy, mapW, mapH);

  // initialize the d3 path with which to draw the geography:
  projectionPath = d3.geo.path().projection(projection);

  caseStudy.radars.forEach(function (radar) {
    radar.projection = projection(radar.location);
  });

  initAnchors(caseStudy);
}

/** Initialize the anchors. */
function initAnchors(caseStudy) {
  var locTopLeft = projection.invert([0, 0]);  // the location at the top-left corner
  var locBotRight = projection.invert([mapW, mapH]);  // the loc. at the bottom-right
  var rra = utils.geo.distAngle(radarAnchorRadius);  // radar radius as angle
  var dlon = utils.geo.destination(caseStudy.mapCenter, 90, caseStudy.anchorInterval)[0]
    - caseStudy.mapCenter[0];  // longitude delta
  var dlat = utils.geo.destination(caseStudy.mapCenter, 0, caseStudy.anchorInterval)[1]
    - caseStudy.mapCenter[1];  // latitude delta
  anchorLocations = [];
  for (var lon = locTopLeft[0]; lon < locBotRight[0]; lon += dlon) {
    for (var lat = locTopLeft[1]; lat > locBotRight[1]; lat -= dlat) {
      caseStudy.radars.forEach(function (radar) {
        if (utils.degrees(d3.geo.distance(radar.location, [lon, lat])) <= rra) {
          anchorLocations.push([lon, lat]);
        }
      });
    }
  }
}

function drawMap(mapG, caseStudy) {
  mapG.append("rect")
    .attr("id", "background")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", mapW)
    .attr("height", mapH);
  mapG.append("path")
    .attr("id", "land")
    .datum(topojson.feature(
      caseStudy.topoJson,
      caseStudy.topoJson.objects.countries
    ))
    .attr("d", projectionPath);
  mapG.append("path")
    .attr("id", "country-boundary")
    .datum(topojson.mesh(
      caseStudy.topoJson,
      caseStudy.topoJson.objects.countries,
      function(a, b) { return a !== b; }
    ))
    .attr("d", projectionPath);
  mapG.append("path")
    .attr("id", "graticule")
    .datum(d3.geo.graticule().step([1, 1]))
    .attr("d", projectionPath);

  // draw radars:
  var rra = utils.geo.distAngle(radarAnchorRadius); // radar radius as angle:
  var radarG = mapG.append("g").attr("id", "radars");
  if (showRadarLabels) {
    var radarLabelsG = mapG.append("g").attr("id", "radar-labels");
  }
  caseStudy.radars.forEach(function (radar) {
    radarG.append("path")
      .attr("id", "radar-radius")
      .datum(d3.geo.circle().origin(radar.location).angle(rra))
      .attr("d", projectionPath);

    if (showRadarLabels) {
      var rp = projection(radar.location);
      radarLabelsG.append('circle')
        .attr('cx', rp[0])
        .attr('cy', rp[1])
        .attr('r', 1.5)
        .classed("radar-center", true);
      radarLabelsG
        .append("text")
        .attr("x", rp[0] + 4)
        .attr("y", rp[1] + 10)
        .text(radar.id)
        .classed("radar-label", true);
    }

    // Draw series points around radar at the marker radius:
    //var n = 36;
    //for (var i = 0; i < n; i++) {
    //  var bearing = utils.mapRange(i, 0, n, 0, 360);
    //  var dest = utils.geo.destination(radar.location, bearing, radarAnchorRadius);
    //  radarG.append("path")
    //    .datum(d3.geo.circle().origin(dest).angle(.01))
    //    .attr("d", projectionPath)
    //    .classed("highlight3", true);
    //}
  });
}

/**
 * Draw the paths.
 */
function drawPaths(data, pathsG) {
  if (singlePath) {
    drawPaths_singlePath(data, pathsG);
  }
  else {
    drawPaths_multiPath(data, pathsG);
  }
}

// Debug
//var debugAnchorId = 540;
//function anchorId(anchorLoc) {
//  return anchorLocations.indexOf(anchorLoc);
//}
//function isDebug(anchorLoc) {
//  return anchorLoc == anchorLocations[debugAnchorId];
//}

/**
 * @param data {timamp.dataObject}
 * @param pathsG {svg.g}
 */
function drawPaths_multiPath(data, pathsG) {
  //console.log(">> app.drawPaths_multiPath");
  Math.seedrandom('ENRAM');
  var rlons = data.caseStudy.radLons;
  var rlats = data.caseStudy.radLats;
  var idw = utils.idw;
  var strn = data.strataCount;
  var radiusFactor = 0.05;
  var probf = anchorArea / data.focus.migrantsPerPath;
  for (var stri = 0; stri < strn; stri++) {
    try {
      var densities = data.avDensities[stri]; // birds/km2 in the strata
    }
    catch (error) {
      console.error("- stri: " + stri);
      console.error("- strn: " + strn);
      console.error("- data.avDensities: " + data.avDensities);
      throw (error);
    }

    anchorLocations.forEach(function (anchorLoc) {
      try {
        var density = idw(anchorLoc[0], anchorLoc[1], densities, rlons, rlats, 2);
      }
      catch (error) {
        console.error("- anchorLoc: " + anchorLoc);
        throw (error);
      }

      // Only continue for a subset of anchor locations, selected by a probability based
      // on the average density:
      if (Math.random() < density * probf) {
        //console.log("- active anchorId(anchorLoc): " + anchorId(anchorLoc));

        var pathData = timamp.buildPathData(data, stri, anchorLoc);
        if (pathData.length == 0) {
          //console.log("got empty pathData");
          return;
        }

        var lineData = timamp.buildOutline(pathData, radiusFactor);
        var flowG = pathsG.append("g").classed("flow-line", true);
        var lcolor = data.caseStudy.altHexColors[stri];
        drawPath_variableThickness(flowG, pathData, lineData, stri, radiusFactor, lcolor);

        // DEBUG:
        //if (isDebug(anchorLoc)) {
        //  console.log(pathData);
        //  flowG.select("path").style("fill", "#f00");
        //}
      }
    });
  }
}

function drawPaths_singlePath(data, pathsG) {
  var strn = data.strataCount;
  var tdy = Math.min(12 * strn, 150);
  var radiusFactor = 0.05;
  for (var stri = 0; stri < strn; stri++) {
    data.caseStudy.radars.forEach(function (radar, radi) {
      var oy = utils.mapRange(stri, 0, strn - 1, tdy / 2, -tdy / 2);
      // draw anchor marks:
      pathsG.append('circle')
        .attr('cx', radar.projection[0])
        .attr('cy', radar.projection[1] + oy)
        .attr('r', 1)
        .classed("acchor", true);
      if (data.avDensities[stri][radi] == 0) {
        return;  // do not draw empty paths
      }
      var pathData = buildPathData_singlePath(data, stri, radi, radar.location);
      pathData = pathData.map(function (d) {
        return [d[0], d[1] + oy, d[2], d[3]];
      });
      var lineData = timamp.buildOutline(pathData, radiusFactor);
      var lcolor = data.caseStudy.altHexColors[stri];
      drawPath_variableThickness(pathsG.append("g"),
        pathData, lineData, stri, radiusFactor, lcolor);
    });
  }
}

function buildPathData_singlePath(data, stri, radi, anchorLoc) {
  var pathData = [];
  var segi, segn = data.segmentCount;
  var loc, dlon, dlat, pp, angl, dist, dens;
  var tf1 = data.caseStudy.segmentSize * 0.06;  // 0.06 = 60 sec. * 0.001 km/m
  var half = Math.floor(data.segmentCount / 2);

  // tail half:
  loc = anchorLoc;
  pp = projection(loc);
  for (segi = half - 1; segi >= 0; segi--) {
    dlon = data.uSpeeds[segi][stri][radi] * tf1;
    dlat = data.vSpeeds[segi][stri][radi] * tf1;
    angl = Math.atan2(-dlon, -dlat);
    dist = utils.vectorLength(dlon, dlat);
    loc = utils.geo.destinationRad(loc, angl, dist);
    dens = data.densities[segi][stri][radi];
    pp = projection(loc);
    pp.push(dens, angl + Math.PI);
    pathData.unshift(pp);
  }

  // front half:
  loc = anchorLoc;
  pp = projection(loc);
  for (segi = half; segi < segn; segi++) {
    pp = projection(loc);
    dens = data.densities[segi][stri][radi];
    dlon = data.uSpeeds[segi][stri][radi] * tf1;
    dlat = data.vSpeeds[segi][stri][radi] * tf1;
    angl = Math.atan2(dlon, dlat);
    pp.push(dens, angl);
    pathData.push(pp);
    dist = utils.vectorLength(dlon, dlat);
    loc = utils.geo.destinationRad(loc, angl, dist);
  }

  pp = projection(loc);
  pp.push(dens, 0);  // same density as last segment
  pathData.push(pp);

  return pathData;
}

var lineFn = d3.svg.line()
  .x(function (d) { return d[0]; })
  .y(function (d) { return d[1]; })
  .interpolate("cardinal-closed");

function drawPath_fixedThickness(data, pathG, pathData, stri) {
  var lcolor = caseStudy.altHexColors[stri];
  var segi, segn = data.segmentCount;
  for (segi = 0; segi < segn; segi++) {
    var node1 = pathData[segi];
    var node2 = pathData[segi + 1];
    var dens = (node1[2] + node2[2]) / 2;
    var lwidth = utils.mapRange(dens, 0, 100, 0, 10);
    //console.log(node1, node2, dens, lwidth, lcolor);
    pathG.append("line")
      .attr("x1", node1[0]).attr("y1", node1[1])
      .attr("x2", node2[0]).attr("y2", node2[1])
      .attr("style", "stroke:" + lcolor
      + ";stroke-width: " + lwidth
      + ";stroke-linecap: round"
      + ";opacity: 1");
  }
}

function drawPath_variableThickness(flowG, pathData, lineData, stri, radiusFactor, lcolor) {
  //console.log(lineData.map(function (d) {
  //  return '[' + d[0] + ', ' + d[1] + ']';
  //}));
  var segn = pathData.length - 1;
  var radius;

  // draw paths:
  var opacity = arty ? .6 : .7;
  flowG.append("path")
    .attr("d", lineFn(lineData))
    .style({fill: lcolor, "fill-opacity": opacity });

  // draw head dot:
  if (arty) {
    radius = 0;
    pathData.forEach(function (d) { radius += d[2]; });
    radius = Math.max(1, radius / pathData.length);
    opacity = .5;
  }
  else {
    radius = utils.constrain(pathData[segn][2] * radiusFactor + .5, 1.5, 3);
    opacity = 1;
  }
  flowG.append('circle')
    .attr('cx', pathData[segn][0])
    .attr('cy', pathData[segn][1])
    .attr('r', radius)
    .attr("style", "fill: " + lcolor + "; fill-opacity: " + opacity + ";");
}

/**
 * Draws the color legend in a horizontal layout.
 * @param caseStudy {enram.caseStudy}
 * @param focus {enram.focus}
 * @param legendG
 */
function drawColorLegend_hor(caseStudy, focus, legendG) {
  var legendH = 12;
  var legendL = 25;
  //var tx0 = legendL;
  //var td = 6;
  var ty = mapH - 20 - legendH - 8;
  var markerGr = legendG.append("g");
  markerGr.append("text")
    .classed("legend-label", true)
    .attr("x", legendL)
    .attr("y", ty)
    .attr("text-anchor", "middle")
    .text("0");
  markerGr.append("text")
    .classed("legend-label", true)
    .attr("x", legendL + legendW / 2)
    .attr("y", ty)
    .attr("text-anchor", "middle")
    .text("2");
  markerGr.append("text")
    .classed("legend-label", true)
    .attr("x", legendL + legendW + 6)
    .attr("y", ty)
    .attr("text-anchor", "middle")
    .text("4 km");

  var lineH = 7;
  legendG.append("line")
    .classed("scale-legend-line", true)
    .attr("x1", legendL)
    .attr("y1", mapH - 20 - legendH - lineH)
    .attr("x2", legendL)
    .attr("y2", mapH - 20);
  legendG.append("line")
    .classed("scale-legend-line", true)
    .attr("x1", legendL + legendW / 2)
    .attr("y1", mapH - 20 - legendH - lineH)
    .attr("x2", legendL + legendW / 2)
    .attr("y2", mapH - 20);
  legendG.append("line")
    .classed("scale-legend-line", true)
    .attr("x1", legendL + legendW)
    .attr("y1", mapH - 20 - legendH - lineH)
    .attr("x2", legendL + legendW)
    .attr("y2", mapH - 20);

  var tx = legendL;
  ty = mapH - 20 - legendH;
  var alti, altn = focus.strataCount(caseStudy);
  var dx = legendW / altn;
  for (alti = 0; alti < altn; alti++) {
    legendG.append("rect")
      .attr("x", tx)
      .attr("y", ty)
      .attr("width", Math.ceil(dx))
      .attr("height", legendH)
      .attr("style", "fill:" + caseStudy.altHexColors[alti] + ";");
    tx += dx;
  }
}

/**
 * Draws the color legend in a vertical layout.
 * @param caseStudy {enram.caseStudy}
 * @param focus {enram.focus}
 * @param legendG
 */
function drawColorLegend(caseStudy, focus, legendG) {
  var margin = 20;
  var legendW = 12;
  var legendH = 100;
  var legendT = margin;

  var altitudeRange = focus.altitudeRange(caseStudy);
  var minHeight = altitudeRange[0] / 1000;
  var midHeight = (altitudeRange[0] + altitudeRange[1]) / 2000;
  var maxHeight = altitudeRange[1] / 1000;

  var ty = legendT;
  var alti, altn = focus.strataCount(caseStudy);
  var dy = legendH / altn;
  for (alti = altn - 1; alti >= 0; alti--) {
    legendG.append("rect")
      .attr("x", margin)
      .attr("y", ty)
      .attr("width", legendW)
      .attr("height", Math.ceil(dy))
      .attr("style", "fill:" + caseStudy.altHexColors[alti] + ";");
    ty += dy;
  }

  var lineW = 7;
  var x2 = margin + legendW + lineW;
  legendG.append("line")
    .classed("scale-legend-line", true)
    .attr("x1", margin)
    .attr("y1", legendT)
    .attr("x2", x2)
    .attr("y2", legendT);
  legendG.append("line")
    .classed("scale-legend-line", true)
    .attr("x1", margin + legendW)
    .attr("y1", legendT + legendH / 2)
    .attr("x2", x2)
    .attr("y2", legendT + legendH / 2);
  legendG.append("line")
    .classed("scale-legend-line", true)
    .attr("x1", margin)
    .attr("y1", legendT + legendH)
    .attr("x2", x2)
    .attr("y2", legendT + legendH);

  var x2 = margin + legendW + lineW + 4;
  legendG.append("text")
    .classed("legend-label", true)
    .attr("x", x2)
    .attr("y", legendT + 8)
    .text(maxHeight + "km");
  legendG.append("text")
    .classed("legend-label", true)
    .attr("x", x2)
    .attr("y", legendT + legendH / 2 + 4)
    .text(midHeight + " km");
  legendG.append("text")
    .classed("legend-label", true)
    .attr("x", x2)
    .attr("y", legendT + legendH)
    .text(minHeight + " km");
  legendG.append("text")
    .classed("legend-label", true)
    .attr("x", margin + legendW + lineW + 2)
    .attr("y", legendT + legendH + 12)
    .text("altitude");
}

/**
 * Draws the scale legend.
 * @param caseStudy {enram.caseStudy}
 * @param legendG
 * @param markers
 */
function drawScaleLegend(caseStudy, legendG, markers) {
  var totalKm = markers[2];
  var radar = caseStudy.radars[0];
  var destProj = projection(utils.geo.destination(radar.location, 90, totalKm));
  var legendW = destProj[0] - projection(radar.location)[0];
  var marginR = 45;
  var legendL = mapW - marginR - legendW;
  var legendR = mapW - marginR;
  var lineH = 7;
  var ty = mapH - 20 - lineH - 4;

  var markerGr = legendG.append("g");
  markerGr.append("text")
    .classed("legend-label", true)
    .attr("x", legendL)
    .attr("y", ty)
    .attr("text-anchor", "middle")
    .text("0");
  markerGr.append("text")
    .classed("legend-label", true)
    .attr("x", (legendL + legendR) / 2)
    .attr("y", ty)
    .attr("text-anchor", "middle")
    .text(markers[1]);
  markerGr.append("text")
    .classed("legend-label", true)
    .attr("x", legendR + 8)
    .attr("y", ty)
    .attr("text-anchor", "middle")
    .text(markers[2] + " km");

  legendG.append("line")
    .classed("scale-legend-line", true)
    .attr("x1", legendL)
    .attr("y1", mapH - 20)
    .attr("x2", legendR)
    .attr("y2", mapH - 20);
  legendG.append("line")
    .classed("scale-legend-line", true)
    .attr("x1", legendL)
    .attr("y1", mapH - 20 - lineH)
    .attr("x2", legendL)
    .attr("y2", mapH - 20);
  legendG.append("line")
    .classed("scale-legend-line", true)
    .attr("x1", (legendL + legendR) / 2)
    .attr("y1", mapH - 20 - lineH)
    .attr("x2", (legendL + legendR) / 2)
    .attr("y2", mapH - 20);
  legendG.append("line")
    .classed("scale-legend-line", true)
    .attr("x1", legendR)
    .attr("y1", mapH - 20 - lineH)
    .attr("x2", legendR)
    .attr("y2", mapH - 20);
}

/**
 * @param caseStudy {enram.caseStudy}
 * @param focus {enram.focus}
 * @param clipG
 */
function writeMetaData(caseStudy, focus, clipG) {
  if (!writeMetaDataInViz) return;

  var mdG = clipG.append("g").attr("id", "meta-data");
  var margin = 18;
  var lh = 12;
  var ly = mapH - 7 - 3 * lh;
  var formatString = "HH[h], MMM D, YYYY";
  var tillMoment = moment(focus.from).add(focus.duration, "hours");

  mdG.append("text")
    .classed("legend-label", true)
    .attr("x", margin)
    .attr("y", ly)
    .text("From:");
  mdG.append("text")
    .classed("legend-label", true)
    .attr("x", margin + 35)
    .attr("y", ly)
    .text(focus.from.format(formatString));

  ly += lh;
  mdG.append("text")
    .classed("legend-label", true)
    .attr("x", margin)
    .attr("y", ly)
    .text("Till:");
  mdG.append("text")
    .classed("legend-label", true)
    .attr("x", margin + 35)
    .attr("y", ly)
    .text(tillMoment.format(formatString));

  ly += lh;
  mdG.append("text")
    .classed("legend-label", true)
    .attr("x", margin)
    .attr("y", ly)
    .text("Migrants per line: " + focus.migrantsPerPath);
}

