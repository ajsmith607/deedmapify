#!/usr/bin/env node

let ConfigFile = (process.argv[2]) ? process.argv[2] : "maps.yaml";
let outputdir = (process.argv[3]) ? process.argv[3] : "./maps";
let outputformats = (process.argv[4]) ? process.argv[4] : "svg";
let svgbasefile = (process.argv[5]) ? process.argv[4] : "base.svg";

const SVGFiles = require("./SVGFiles")
SVGFiles.GenerateAllSVGFiles(ConfigFile, outputdir, outputformats, svgbasefile); 





