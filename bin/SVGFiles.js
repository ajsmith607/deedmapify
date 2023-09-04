
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const FileHelper = require("./FileHelper");
const MapMath = require("./MapMath"); 
const splitwords = MapMath.splitwords;
const logall = MapMath.logall;
const MapLayers = require("./MapLayers"); 
const SVGHelper = require("./SVGHelper"); 
const sharp = require("sharp");
const winston = require('winston');

const log = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});
const debug = log.debug;

function savePNG(svgfile, outputdir) {
    let basename = path.basename(svgfile, ".svg");
    let svgpath = path.join(outputdir, svgfile);
    let pngpath = path.join(outputdir, basename + ".png");
    sharp(svgpath)
      .withMetadata({ density: 300 })
      .png({ quality: 100 })
      .toFile(pngpath)
      .then(function(info) {
        console.log(info)
      })
      .catch(function(err) {
        console.log(err)
      })
}

function RemoveOrphanFiles (filesConfig, dir) {
    let filenamelist = [];
    for (let i=0; i < filesConfig.length; i++) {
        if (filesConfig[i].filename) {
            let filepath = path.join(dir, filesConfig[i].filename);
            filenamelist.push(filepath);
        }
    }

    let filepaths = FileHelper.GetFiles(dir);
    for (let f=0; f < filepaths.length; f++) {
        console.log("checking file: %s", filepaths[f]);
        if (! filenamelist.includes(filepaths[f])) {
            FileHelper.DeleteFile(filepaths[f]);
        }
    }
}


function AddGrid (BaseLayer) {
    if (BaseLayer.grids && BaseLayer.grids.length) {
        let allgridgroups = SVGHelper.CreateGroupElement("grids");

        let [minx, miny] = [BaseLayer.minx, BaseLayer.miny];
        let [maxx, maxy] = [BaseLayer.maxx, BaseLayer.maxy];
        logall({minx},{miny},{maxx},{maxy});

        function drawGridGroup(type, cellsize, rulesize=1, skipsize=0) {
            if (type == "minor") { rulesize = "0.25"; }
            cellsize = parseFloat(cellsize);
            let gridgroup = SVGHelper.CreateGroupElement(type);

            // support for non-scaling-stroke appears to be hit or miss,
            // so, explicitly set, thickness, opacity, etc.
            //gridgroup.attributes["vector-effect"] = "non-scaling-stroke";
            gridgroup.attributes["stroke"] = "lightgray";
            gridgroup.attributes["stroke-width"] = rulesize;


            //<line x1="0" y1="-132.8" x2="0" y2="8"/>
            //<line x1="-10" y1="-132.8" x2="-10" y2="8"/>
            // Draw vertical lines at cellsize intervals
            for (let x = 0; x >= minx; x -= cellsize) {
                if ((skipsize > 0) && (x % skipsize === 0)) { 
                    x -= cellsize; 
                } else {
                    gridgroup.children.push(SVGHelper.CreateLineElement(x, miny, x, maxy));
                }
            }

            for (let x = 0; x <= maxx; x += cellsize) {
                if ((skipsize > 0) && (x % skipsize === 0)) { 
                    x += cellsize; 
                } else {
                    gridgroup.children.push(SVGHelper.CreateLineElement(x, miny, x, maxy));
                } 
            }

            // Draw horizontal lines at cellsize intervals
            for (let y = 0; y >= miny; y -= cellsize) {
                if ((skipsize > 0) && (y % skipsize === 0)) { 
                    y -= cellsize; 
                } else {
                    gridgroup.children.push(SVGHelper.CreateLineElement(minx, y, maxx, y));
                }
            }
            
            for (let y = 0; y <= maxy; y += cellsize) {
                if ((skipsize > 0) && (y % skipsize === 0)) { 
                    y += cellsize; 
                } else {
                    gridgroup.children.push(SVGHelper.CreateLineElement(minx, y, maxx, y));
                }
            }
            allgridgroups.children.push(gridgroup);
        } // end inline function drawGridGroup 

        let gridorder = ["minor","major"];
        for (gord=0; gord < gridorder.length; gord++) {
            let nexttype = gridorder[gord];
            for (let g=0; g < BaseLayer.grids.length; g++) {
                let gridinstruction = splitwords(BaseLayer.grids[g]);
                let type = gridinstruction[0];
                if (nexttype == type) {
                    let feet = MapMath.GetFeetOnly(gridinstruction.slice(1).join(" "));
                    drawGridGroup(type, feet);
                }
            }
        }

        // find the last layer with images
        let lastimagelayer = 1;
        for (l=0; l < BaseLayer.svg.children.length; l++) {
            if (BaseLayer.svg.children[l].images && BaseLayer.svg.children[l].images.length) {
                lastimagelayer = l;
            }
        }
        // insert after images group, before drawing
        BaseLayer.svg.children.splice(lastimagelayer, 0, allgridgroups);
    }
    return BaseLayer;
}


function AddMargin(BaseLayer) {
    let marginvals = [0,0,0,0];
    if (BaseLayer.margin) {
        margins = BaseLayer.margin.split(' ');
        if (margins.length == 2) {
            let [templen, tempunits] = [ margins[0], margins[1] ];
            templen = MapMath.converttofeet(templen, tempunits);
            marginvals = [templen, templen, templen, templen];
        }

        if (margins.length == 8) {
            for (valindex = 0; valindex < margins.length; valindex+=2) {
                let [templen, tempunits] = [ margins[valindex], margins[valindex + 1] ];
                templen = MapMath.converttofeet(templen, tempunits);
                marginvals.push(templen);
            }
        }
    }

    // the order difference here is important...
    BaseLayer.maxx = BaseLayer.maxx + marginvals[0];
    BaseLayer.maxy = BaseLayer.maxy + marginvals[1];
    BaseLayer.minx = BaseLayer.minx - marginvals[2];
    BaseLayer.miny = BaseLayer.miny - marginvals[3];
    return BaseLayer;
}

function FindEncompassingBoundingBox(boundingBoxes) {

    if (boundingBoxes.length === 0) {
        return null; // No bounding boxes to calculate
    }

    let minx = Number.MAX_VALUE;
    let miny = Number.MAX_VALUE;
    let maxx = Number.MIN_VALUE;
    let maxy = Number.MIN_VALUE;

    for (let b=0; b < boundingBoxes.length; b++) {
        let bbox = boundingBoxes[b]; 
        minx = Math.min(minx, bbox.minx);
        miny = Math.min(miny, bbox.miny);
        maxx = Math.max(maxx, bbox.maxx);
        maxy = Math.max(maxy, bbox.maxy);
    }

    return { minx: minx, miny: miny, maxx: maxx, maxy: maxy };
}


function mergeLayers (parent, child) {
    const merged = JSON.parse(JSON.stringify(parent)); // Create a deep copy of the parent object
    for (const prop in child) {
        if (prop === 'instructions') {
            if (merged.instructions) {
                merged.instructions = merged.instructions.concat(child.instructions);
            } else {
                merged.instructions = child.instructions;
            }
        } else {
                merged[prop] = child[prop]; // Merge other properties from child into merged object
        }
  }

  return merged;
}

/*
let parent = {"id":"dresser-mag","title":"2023 Dresser Survey.","instructions":["addimage images/dresser.jpg"]}, 
let child = {"id":"dresser-true","parentid":"dresser-mag","magdecl":"-11,43"}
let merged = mergeLayers(parent, child);
*/

function createLayerMap(Layers) {
    const LayerMap = new Map();
    for (let layer of Layers) {
        if (layer && layer.id) {
            LayerMap.set(layer.id, layer);
        } 
    }
    return LayerMap;
}


// Function to recursively extract line and path elements
function extractLinesAndPaths(FileLayersMap) {
    AllLines = [];
    for (let [layerid, thislayer] of FileLayersMap) {
        for (let s=0; s < thislayer.steps.length; s++) {
            let line = { points: [] };
            for (let p=0; p < thislayer.steps[s].points.length; p++) {
                let x = thislayer.steps[s].points[p].x;
                let y = thislayer.steps[s].points[p].y;
                logall({x},{y});
                console.log("thislayer.rotate: %s", thislayer.rotate); 
                ({x, y} = MapMath.MoveAndRotatePoint(x, y, thislayer.xoffset, thislayer.yoffset, 0));
                logall({x},{y});
                line.points[p] = { x: x, y: y };
            }
            AllLines.push(line);
        }
    }
    return AllLines;
}

function getRightAnglePaths(AllLines, space) {
    // collect all steps and rules to find parallel and perpendicular lines 
    // both steps and lines share the same underlying metadata about distances, bearings, etc. 
    let rightanglepaths = [];
    for (let l=0; l < AllLines.length - 1; l++) {
      for (let m = l + 1; m < AllLines.length; m++) {
        const line1 = AllLines[l];
        const line2 = AllLines[m];
        const intersectionpoint = MapMath.GetIntersectionPoint(line1, line2);
        let intx = intersectionpoint.x; let inty = intersectionpoint.y;
        if (intersectionpoint.x !== null && intersectionpoint.y !== null) {
            let rightanglepointsets = MapMath.GetRightAnglePoints(line1, line2, intersectionpoint, space) 
            for (let r=0; r < rightanglepointsets.length; r++) {
                let rightanglepoints = rightanglepointsets[r];
                let anglen = rightanglepoints.length;
                if (rightanglepoints && rightanglepoints.length ==3) {
                    let [rax, ray] = [rightanglepoints[0].x, rightanglepoints[0].y];
                    rightanglepaths.push(SVGHelper.CreateLineElement(rightanglepoints[1].x, rightanglepoints[1].y, rax, ray));
                    rightanglepaths.push(SVGHelper.CreateLineElement(rightanglepoints[2].x, rightanglepoints[2].y, rax, ray));
                } 
            }
        }
      }
    }

    let ragroup = SVGHelper.CreateGroupElement("rightangles");
    ragroup.attributes["stroke"] = "lightgray";
    ragroup.children.push(rightanglepaths);
    return ragroup;
}


function mergeParentsAndChildren(Layers) {
    const LayerMap = createLayerMap(Layers); 
    
    function applyMerge(child) {
        const parentid = child.parentid;
        if (parentid) {
            const parent = LayerMap.get(parentid);
            if (parent) {
                applyMerge(parent);
                child = mergeLayers(parent, child);
            }
        } 
        return child;
    }
  
    let mergedLayers = [];
    for (let c=0; c < Layers.length; c++) {
        let child = Layers[c];
        child = applyMerge(child);
        child = mergeLayers(MapLayers.LayerDefaults, child);
        mergedLayers.push(child);
    }

    return mergedLayers; // Return the modified array
}

exports.GenerateAllSVGFiles = function (ConfigFile="./maps.yaml", outputdir="./maps", outputformats="svg", svgbasefile="./base.svg") {

    let MappingConfig = {};
    try { MappingConfig= yaml.load(fs.readFileSync(ConfigFile, "utf8")); } catch (error) { console.error(error); }

    // prepare all layers before constructing the file
    AllOrderedLayers = mergeParentsAndChildren(MappingConfig.layers);
    const CompiledLayerMap = MapLayers.CompileAllMapLayers(AllOrderedLayers);

    for (f=0; f < MappingConfig.files.length; f++) {
        const scale = MappingConfig.files[f].scale || 1; 
        const FileLayersMap = new Map();
        BaseLayer = mergeLayers(MapLayers.LayerDefaults, {});
        BaseLayer.grids = [];
        BaseLayer.svg = SVGHelper.CreateSVGBaseGroup(scale);
        BaseLayer.minx = Number.MAX_VALUE;
        BaseLayer.miny = Number.MAX_VALUE;
        BaseLayer.maxx = Number.MIN_VALUE;
        BaseLayer.maxy = Number.MIN_VALUE;

        let FileInstructions = MappingConfig.files[f].instructions;
        for (i=0; i < FileInstructions.length; i++) {
            let Instruction = FileInstructions[i];
            console.log("FILE Instruction: %s ", Instruction);
            let File
            let args = splitwords(Instruction);
            let Command = args.shift();
            Instruction = args.join(" ");
            switch (Command) {
                case "layer":
                    let layerid = Instruction;
                    let layerfound = CompiledLayerMap.get(layerid);
                    if (layerfound) {
                        FileLayersMap.set(layerfound.id, layerfound);
                    } 
                    break;
                case "align":
                    let [stepnum1, pointnum1, layerid1, stepnum2, pointnum2, layerid2] = splitwords(Instruction);
                    let [x1, y1, x2, y2] = [0 ,0, 0, 0];

                    let layer1 = FileLayersMap.get(layerid1);
                    if (! layer1) { layer1 = CompiledLayerMap.get(layerid1); } 

                    let layer2 = FileLayersMap.get(layerid2);
                    if (! layer2) { layer2 = CompiledLayerMap.get(layerid2); } 

                    if (layer1 && layer2) {
                        x1 = layer1.steps[parseInt(stepnum1) - 1].points[parseInt(pointnum1) - 1].x 
                        y1 = layer1.steps[parseInt(stepnum1) - 1].points[parseInt(pointnum1) - 1].y;
                        ({x1, y1} = MapMath.MoveAndRotatePoint(x1, y1, layer1.xoffset, layer1.yoffset, layer1.rotate));

                        x2 = layer2.steps[parseInt(stepnum2) - 1].points[parseInt(pointnum2) - 1].x 
                        y2 = layer2.steps[parseInt(stepnum2) - 1].points[parseInt(pointnum2) - 1].y;
                        ({x2, y2} = MapMath.MoveAndRotatePoint(x2, y2, layer2.xoffset, layer2.yoffset, layer2.rotate));
    
                        layer2.xoffset = layer2.xoffset - (x2 - x1);
                        layer2.yoffset = layer2.yoffset - (y2 - y1);
                    }

                    // if layers have not already been added, add them
                    // reset layers, or add if they are not already there
                    FileLayersMap.set(layer1.id, layer1);
                    FileLayersMap.set(layer2.id, layer2);
                    break;
                case "rulepoints":
                    [stepnum1, pointnum1, layerid1, stepnum2, pointnum2, layerid2] = splitwords(Instruction);
                    [x1, y1, x2, y2] = [0 ,0, 0, 0];

                    layer1 = FileLayersMap.get(layerid1);
                    if (! layer1) { layer1 = CompiledLayerMap.get(layerid1); } 

                    layer2 = FileLayersMap.get(layerid2);
                    if (! layer2) { layer2 = CompiledLayerMap.get(layerid2); } 

                    if (layer1 && layer2) {
                        x1 = layer1.steps[parseInt(stepnum1) - 1].points[parseInt(pointnum1) - 1].x 
                        y1 = layer1.steps[parseInt(stepnum1) - 1].points[parseInt(pointnum1) - 1].y;
                        ({x1, y1} = MapMath.MoveAndRotatePoint(x1, y1, layer1.xoffset, layer1.yoffset, layer1.rotate));

                        x2 = layer2.steps[parseInt(stepnum2) - 1].points[parseInt(pointnum2) - 1].x 
                        y2 = layer2.steps[parseInt(stepnum2) - 1].points[parseInt(pointnum2) - 1].y;
                        ({x2, y2} = MapMath.MoveAndRotatePoint(x2, y2, layer2.xoffset, layer2.yoffset, layer2.rotate));
                        
                        //BaseLayer.svg.children.push(SVGHelper.CreateLineElement(x1, y1, x2, y2));
                        //BaseLayer.svg.children.push(SVGHelper.CreateTextElement;);
                        //function CreateTextElement(label, x, y, dx=4, dy=4, relangle=0, forecolor="black", fontsize=6, textanchor="middle", charwidth=0.6) {
                    }
                    break;
                case "grid":
                    BaseLayer.grids.push(Instruction);
                    break;
                case "margin":
                    BaseLayer.margin = Instruction;
                    break;
                default:
                    console.error("Command: " + Command + ", with instruction: " + Instruction + " is not valid."); 
            }
        }

        let AllLines = extractLinesAndPaths(FileLayersMap);
        let space = 10;
        let rapathgroup = getRightAnglePaths(AllLines, space); 
        BaseLayer.svg.children.push(rapathgroup);

        // generate SVG markup for all layers and calculate bounding box
        for (let [layerid, thislayer] of FileLayersMap) {
            thislayer = SVGHelper.GenerateSVG(thislayer);  
            BaseLayer.svg.children.push(thislayer.svg); 
            thislayer.scale = scale;
            thislayer = SVGHelper.GetElementsBoundingBox(thislayer);
            thislayer = SVGHelper.ScaleElementsBoundingBox(thislayer);
            BaseLayer.minx = Math.min(MapMath.rounddown(thislayer.minx), BaseLayer.minx);
            BaseLayer.miny = Math.min(MapMath.rounddown(thislayer.miny), BaseLayer.miny);
            BaseLayer.maxx = Math.max(MapMath.rounddown(thislayer.maxx), BaseLayer.maxx);
            BaseLayer.maxy = Math.max(MapMath.rounddown(thislayer.maxy), BaseLayer.maxy);
        }
        
        // add grids  and margins
        BaseLayer = AddGrid(BaseLayer); 
        BaseLayer = AddMargin(BaseLayer);

        // output final results
        let svg =  SVGHelper.CreateSVGElement(svgbasefile, dir="./"); 
        let width = BaseLayer.maxx - BaseLayer.minx;
        let height = BaseLayer.maxy - BaseLayer.miny;
        svg.attributes.width = width;
        svg.attributes.height = height;
        svg.attributes.viewBox = [BaseLayer.minx, BaseLayer.miny, width, height].join(" ");  
        svg.children.push(BaseLayer.svg);
        if (outputformats.includes("svg")) { SVGHelper.SaveSVGJSON (svg, MappingConfig.files[f].filename, outputdir, outputformats); }
        if (outputformats.includes("png")) { savePNG(MappingConfig.files[f].filename, outputdir); }
    }

    RemoveOrphanFiles(MappingConfig.files, outputdir);
    process.exit();
}
