<h1>TIMAMP v2</h1>

[toc]

# Introduction

This project offers a web-based data visualization of bird migration data. See below more details about the visualization.

# Development Notes

## Prerequisites

To edit this project, you will need the following software:

- [Node.js][1] – Use the [installer](https://nodejs.org/en/download/) for your OS.
- [Gulp][4] – This depedency is required in the `./package.json` and thus installed by _npm_, but It is probably best to install it globally by running the following command: `npm install -g gulp`. Depending on how Node is configured on your machine, you may need to run `sudo npm install -g gulp` instead, if you get an error with the first command.

## Building the app

The source code (HTML, JS, CSS, ...) is maintained in the `./src/` directory.
The build website consists of html files in the project's root directory and js/css and other assets in the `./assets' directory.
The website is published as GitHub ghpages.

To build the project, run:

```bash
npm start
```

This will:

- concatenate and minify the client js-files in `./assets/js/app.js`;
- concatenate and minify the vendor css-files in `./assets/css/vendor.css`;
- concatenate and minify the vendor js-files in `./assets/js/vendor.js`;
- copy all asset files to `./assets/...`;
- open the (built) app in a browser; and
- start a file-change watcher that recompiles the build and reloads the browser when source files are modified.

## Dependencies

Npm is used for managing 3rd-party dependencies. The npm configuration is specified in the file `./package.json` while the packages are located in the directory `./node_modules/`. The file `./npm-debug.log` contains npm related debug/log messages.

### Development dependencies

The development setup depends on the following libraries and tools:

- [Gulp][4] – Build tool

And a number of Gulp extensions:

- gulp-autoprefixer
- gulp-concat
- gulp-if
- gulp-load-plugins
- gulp-ng-html2js
- gulp-sass
- gulp-sourcemaps
- gulp-uglify
- gulp-webserver
- rimraf – Deleting folders.
- run-sequence
- yargs

### Client dependencies

This project depends on the following framework libraries:

- Foundation – See below for more details.
- [D3][7] – A JavaScript library for manipulating documents based on data.
- jquery – This is (only) needed for Foundation.
- [Moment](http://momentjs.com/) – Parse, validate, manipulate, and display dates in JavaScript.
- [Numeral.js](http://numeraljs.com/) – A javascript library for formatting and manipulating numbers.
- [Seedrandom.js](https://github.com/davidbau/seedrandom) – Seeded random number generator for JavaScript.
- [TopoJSON](https://github.com/mbostock/topojson/wiki) – D3 plugin for drawing topography from topojson data.

This project additionally depends on the following problem solvers:

- [FastClick](https://github.com/ftlabs/fastclick) – Eliminates the 300ms delay between a physical tap and the firing of a click event on mobile browsers, thus making the application feel less laggy and more responsive while avoiding any interference with your current logic.



### Foundation

This app uses Foundation for its responsiveness.
This Foundation is a custom build of v5.5.2 that includes:

* grid
* visibility

The js and css files are maintained in the ./vendor directory.


## About this visualisation

The resulting static visualization is meant to provide a holistic picture of the spatial and temporal variation in migration activity during a period of one to eight hours. To this end it shows a number of pathlines on a geographic map. Each pathline represents the expected travel path of an imaginary swarm of average migrants during the selected time period. This visualization does thus not show the travel paths of actual migrants but rather describes average migration patterns based on the data detailed in the previous sections.





# Future work

The reconstruction of the full migration velocity vector field from the sparse scattered data is done using a naive interpolation technique that assumes a smooth continuous variation of the conditions that affect the migrant velocities in between these samples. This assumption can be expected to not correspond with reality due to the impact of geographical features such as mountain ranges or meteorological features such as weather fronts. Knowledge on the impact of such features on migration patterns is, however, currently rather limited. Indeed, large scale migration data collection efforts, such as the one from which the shown data was sourced, can help expand this knowledge, while tailored visualisation techniques, such as the ones discussed here, are meant to facilitate as well as profit from such progress.

The pathlines in the TIMAMP visualisation are numerically integrated using Euler's method with time increments of 20 minutes, given the temporal aggregation of the (irregular) samples in 20 minutes time windows. The consequent cumulative error should be considered in greater detail. The application of specialised spatio-temporal interpolation and higher order integration techniques, may have to be considered in order to improve fidelity.

The fidelity of the reconstructed migrant density scalar field might benefit from an interpolation approach that takes the correlation with the migrant velocity vector field into account (Streletz ea, 2012).

- Streletz, G. J., Gebbie, G., Spero, H. J., Kreylos, O., Kellogg, L. H. & Hamann, B. (2012) Interpolating Sparse Scattered Oceanographic Data Using Flow Information, dec 2012.
- Weiskopf, D. & Erlebacher, G. (2005) Overview of flow visualization. The Visualization Handbook (eds C. D. Hansen & C. R. Johnson), pp. 261-278. Elsevier Butterworth-Heinmann, Burlington.

# Case study metadata json format

For each case study a set of metadata is provided in a json file. This file contains a json 
object with the following properties:

* __label__ - Text label.
* __dateFrom__ - The first day for which data is available, expressed as an object that can be passed to the moment constructor.
* __dateTill__ - The last day for which data is available, expressed as an object that can be passed to the moment constructor.
* __defaultFocusFrom__ - The initial focus moment, expressed as an object that can be passed to the moment constructor.
* __altitudes__ - The number of altitudes for which data is available.
* __minAltitude__ - The lowest altitude for which data is available.
* __maxAltitude__ - The highest altitude for which data is available.
* __strataCounts__ - The strata count options. Each value in this list must be a whole divisor of the number of altitudes for which data is available (see the *altitudes* property above).
* __defaultStrataCount__ - The default strata count.
* __defaultMigrantsPerPath__ - The number of migrants each pathline represents.
* __segmentSize__ - The duration of each segment, in minutes.
* __anchorInterval__ - The interval between potential anchors in km.
* __mapCenter__ - A list with two elements, the longitude and latitude (in degrees) on which to center the map.
* __mapScaleFactor__ - The factor with which the map-width needs to be multiplied to get the map scaling.
* __queryBaseUrl__ - The base url for the CartoDB queries, relative to the app's base.
* __colorLegendMarkers__ - The markers to be shown in the color legend. (currently unused)
* __scaleLegendMarkers__ - The markers to be shown in the scale legend.
* __radars__ - Array with objects, one for each radar, containing the following properties:
    * __id__ - The unique id.
    * __name__ 
    * __country__ - country code (currently unused)
    * __type__ - type tag (currently unused)
    * __longitude__ - expressed as a decimal degrees value
    * __latitude__ - expressed as a decimal degrees value
* __altitudes__ - Array with objects, one for each altitude, containing the following properties:
    * __min__ - the minimum of the altitude range
    * __max__ - the maximum of the altitude range
    * __idx__ - the index


# References

- __[Darmofal_96a]__ – _An Analysis of 3D Particle Path Integration Algorithms._ D. L. Darmofal. Journal of Computanional Physics 123, 182–195 (1996).

[1]: http://nodejs.org
[4]: http://gulpjs.com
[5]: http://sass-lang.com
[6]: http://foundation.zurb.com/apps/
[7]: http://d3js.org