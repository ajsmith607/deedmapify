
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const { parseSync, stringify } = require("svgson");
const FileHelper = require("./FileHelper");
const MapMath = require("./MapMath"); 
const MapMeta = require("./MapMeta");
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

function savePNG(filebasename, outputdir, printdpi=300) {
    let svgpath = path.join(outputdir, filebasename + ".svg");
    let pngpath = path.join(outputdir, filebasename + ".png");
    sharp(svgpath)
        .withMetadata({ density: printdpi })
        .png({ quality: 100 })
        .toFile(pngpath)
        .then(function(info) {
            console.log("PNG file saving info:", info);
        })
        .catch(function(err) {
            console.log("Error saving PNG file:", err);
        })
}

function RemoveOrphanFiles (filesCreated, dir) {
    let filepaths = FileHelper.GetFiles(dir);
    for (let f=0; f < filepaths.length; f++) {
        if (! filesCreated.includes(filepaths[f])) {
            FileHelper.DeleteFile(filepaths[f]);
        }
    }
}

function AddLegend(BaseLayer, drawinglayersaccum, legendpadding) {
    let offsetx = MapMath.rounddown(BaseLayer.minx);
    let offsety = parseFloat(BaseLayer.maxy);
    let legendgroup = SVGHelper.CreateGroupElement("legend", "black", 0, offsetx, offsety);

    legendpadding = parseFloat(legendpadding);
    let lineheight = MapMath.rounddown(BaseLayer.fontsize * 2);
    let liney = lineheight; 
    let linestartx = legendpadding; 
    let r = BaseLayer.linewidth * 2;
    let linelength = r * 8;
    for (let l=0; l < drawinglayersaccum.length; l++) {
        let thislayer = drawinglayersaccum[l];
        liney += lineheight;
        let circlestartx = MapMath.rounddown(linestartx);
        let startcircle = SVGHelper.CreateCircleElement(circlestartx, liney, r);
        let endcircle = SVGHelper.CreateCircleElement(circlestartx + linelength, liney, r);
        if (l % 2 == 0) {
            endcircle.attributes["stroke"] = "white";
        } else {
            startcircle.attributes["stroke"] = "white";
        }
        let line = SVGHelper.CreatePathElement(circlestartx, liney, MapMath.rounddown(linestartx + linelength), liney); 
        console.log("drawing layer title in legend: %s", thislayer.title);
        let label = (thislayer.title) ? thislayer.title : thislayer.id.replaceAll("-", " ");
        let text = SVGHelper.CreateTextElement(label, MapMath.rounddown(linestartx + linelength + (8)), liney +2, 
                                               0, 0, 0, BaseLayer.fontsize, "start", "middle");
        
        let layerlinegroup = SVGHelper.CreateGroupElement(thislayer.id + "-legend", thislayer.color);
        layerlinegroup.children.push(startcircle);
        layerlinegroup.children.push(endcircle);
        layerlinegroup.children.push(line);
        layerlinegroup.children.push(text);
        legendgroup.children.push(layerlinegroup);
    }
    let addheight = MapMath.rounddown(liney + lineheight);
    return [legendgroup, addheight]; 
    
}

/*
<g id="legend" transform="rotate(0) translate(0 0) scale(3.8)" stroke="black" fill="black" stroke-width="2" stroke-linecap="round" font-family="Roboto, sans-serif" font-size="6" font-weight="bold">

<g id="creek-road-legend" transform="rotate(0) translate(0 0)" stroke="black" fill="black" stroke-width="2" stroke-linecap="round" font-family="Roboto, sans-serif" font-size="6" font-weight="bold">
    <circle cx="-1333.83" cy="415.14" r="4" fill="transparent"/>
    <circle cx="-1317.83" cy="415.14" r="4" fill="transparent"/>
    <path d="M -1333.83 415.14 L -1319.8300000000002 415.14"/>
    <text x="-1311.83" y="415.14" textLength="0" transform="rotate(0 -1311.83 415.14)" stroke="transparent" stroke-width="0" font-size="6" text-anchor="start" dominant-baseline="middle"></text></g>


<g id="1869-mag-legend" transform="rotate(0) translate(0 0)" stroke="#FF4136" fill="#FF4136" stroke-width="2" stroke-linecap="round" font-family="Roboto, sans-serif" font-size="6" font-weight="bold">
    <circle cx="-1333.83" cy="424.14" r="4" fill="transparent"/>
    <circle cx="-1317.83" cy="424.14" r="4" fill="transparent"/>
    <path d="M -1333.83 424.14 L -1319.8300000000002 424.14"/>
    <text x="-1311.83" y="424.14" textLength="0" transform="rotate(0 -1311.83 424.14)" stroke="transparent" stroke-width="0" font-size="6" text-anchor="start" dominant-baseline="middle"></text></g></g></g></svg>

*/

function GetGrids (BaseLayer, scale=1, gridmarginpixels) {
    scale = parseFloat(scale);
    gridmarginpixels = parseFloat(gridmarginpixels) * scale;
    let allgridgroups = {}
    if (BaseLayer.grids && BaseLayer.grids.length) {
        allgridgroups = SVGHelper.CreateGroupElement("grids");
        
        let fontsize = MapMath.rounddown(BaseLayer.fontsize * scale);

        //let [minx, miny] = [BaseLayer.minx - gridmargin, BaseLayer.miny - gridmargin];
        //let [maxx, maxy] = [BaseLayer.maxx + gridmargin, BaseLayer.maxy + gridmargin];
        let minx = MapMath.rounddown(BaseLayer.minx - gridmarginpixels);
        let miny = MapMath.rounddown(BaseLayer.miny - gridmarginpixels);
        let maxx = MapMath.rounddown(BaseLayer.maxx + gridmarginpixels);
        let maxy = MapMath.rounddown(BaseLayer.maxy + gridmarginpixels);

        function drawGridGroup(type, cellsize, scale=1, color="#AAAAAA", rulesize=1, skipsize=0) {
            if (type == "minor") { rulesize = "0.25"; }
            cellsize = MapMath.rounddown(parseFloat(cellsize) * scale);
            let gridgroup = SVGHelper.CreateGroupElement(type);

            // support for non-scaling-stroke appears to be hit or miss,
            // so, explicitly set, thickness, opacity, etc.
            //gridgroup.attributes["vector-effect"] = "non-scaling-stroke";
            gridgroup.attributes["stroke"] = color;
            gridgroup.attributes["stroke-width"] = rulesize;
            let labelspace = MapMath.rounddown(rulesize * scale);
            let baseline = "middle";

            // Draw vertical lines at cellsize intervals
            // remember that y axis is inverted, maxy is at bottom of canvas
            // and the convention for "north-up" maps is to put axis labels on left and bottom
            for (let x = 0; x >= minx; x -= cellsize) {
                if ((skipsize > 0) && (x % skipsize === 0)) { 
                    x -= cellsize; 
                } else {
                    if (x != 0) {
                        x = MapMath.rounddown(x); 
                        gridgroup.children.push(SVGHelper.CreateLineElement(x, miny, x, maxy));
                        if (type == "major") { 
                            let label = MapMath.rounddown(x/scale);     
                            let startgridlabel = SVGHelper.CreateTextElement(label, x, miny, labelspace, 0, 90, fontsize, "end", baseline);
                            gridgroup.children.push(startgridlabel);
                            let endgridlabel = SVGHelper.CreateTextElement(label, x, maxy, labelspace, 0, 90, fontsize, "start", baseline);
                            gridgroup.children.push(endgridlabel);
                        }
                    }
                }
            }

            for (let x = 0; x <= maxx; x += cellsize) {
                if ((skipsize > 0) && (x % skipsize === 0)) { 
                    x += cellsize; 
                } else {
                    x = MapMath.rounddown(x); 
                    gridgroup.children.push(SVGHelper.CreateLineElement(x, miny, x, maxy));
                    if (type == "major") { 
                        let label = MapMath.rounddown(x/scale);
                        if (x == 0) { label = label.toString() + " ft";  }
                        let startgridlabel = SVGHelper.CreateTextElement(label, x, miny, labelspace, 0, 90, fontsize, "end", baseline);
                        gridgroup.children.push(startgridlabel);
                        let endgridlabel = SVGHelper.CreateTextElement(label, x, maxy, labelspace, 0, 90, fontsize, "start", baseline);
                        gridgroup.children.push(endgridlabel);
                    }
                } 
            }

            // Draw horizontal lines at cellsize intervals
            // remember to negate the y value to account for inverted y axis 
            for (let y = 0; y >= miny; y -= cellsize) {
                if ((skipsize > 0) && (y % skipsize === 0)) { 
                    y -= cellsize; 
                } else {
                    if (y != 0) {
                        y = MapMath.rounddown(y);
                        gridgroup.children.push(SVGHelper.CreateLineElement(minx, y, maxx, y));
                        if (type == "major") { 
                            let label = MapMath.rounddown(-y/scale);     
                            let startgridlabel = SVGHelper.CreateTextElement(label, minx, y, -labelspace,  0, 0, fontsize, "end", baseline);
                            gridgroup.children.push(startgridlabel);
                            let endgridlabel = SVGHelper.CreateTextElement(label, maxx, y, -labelspace, 0, 0, fontsize, "start", baseline);
                            gridgroup.children.push(endgridlabel);
                        }
                    }
                }
            }
            
            for (let y = 0; y <= maxy; y += cellsize) {
                if ((skipsize > 0) && (y % skipsize === 0)) { 
                    y += cellsize; 
                } else {
                    y = MapMath.rounddown(y);
                    gridgroup.children.push(SVGHelper.CreateLineElement(minx, y, maxx, y));
                    if (type == "major") { 
                        let label = MapMath.rounddown(-y/scale);
                        if (y == 0) { label = label.toString() + " ft";  }
                        let startgridlabel = SVGHelper.CreateTextElement(label, minx, y, -labelspace, 0, 0, fontsize, "end", baseline);
                        gridgroup.children.push(startgridlabel);
                        let endgridlabel = SVGHelper.CreateTextElement(label, maxx, y, -labelspace, 0, 0, fontsize, "start", baseline);
                        gridgroup.children.push(endgridlabel);
                    }
                }
            }
            allgridgroups.children.push(gridgroup);
        } // end inline function drawGridGroup 

        let gridorder = ["minor","major"];
        for (gord=0; gord < gridorder.length; gord++) {
            let nexttype = gridorder[gord];
            for (let g=0; g < BaseLayer.grids.length; g++) {
                let [type, size, unit, color] = splitwords(BaseLayer.grids[g]);
                type = (type) ? type : "minor";
                unit = (unit) ? unit : "feet";
                color = (color) ? color : "<gray>";
                color = MapLayers.ReplaceColor(color);
                if (nexttype == type) {
                    let feet = MapMath.GetFeetOnly(size + " " + unit);
                    drawGridGroup(type, feet, scale, color);
                }
            }
        }

    } // END if (BaseLayer.grids && BaseLayer.grids.length) {
    return allgridgroups;
}


function AddLayerMargin(layer) {
    layer.minx -= layer.margin;
    layer.miny -= layer.margin;
    layer.maxx += layer.margin;
    layer.maxy += layer.margin;
    return layer;
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



// Function to recursively extract line and path elements
function extractLinesAndPaths(FileLayersMap) {
    console.log("");
    console.log("EXTRACTING LINES AND PATHS");
    AllLines = [];
    for (let [layerid, thislayer] of FileLayersMap) {
        for (let s=0; s < thislayer.steps.length; s++) {
            if (! thislayer.steps[s]) { continue; }
            let line = { points: [] };
            for (let p=0; p < thislayer.steps[s].points.length; p++) {
                let x = thislayer.steps[s].points[p].x;
                let y = thislayer.steps[s].points[p].y;
                //({x, y} = MapMath.MoveAndRotatePoint(x, y, thislayer.xoffset, thislayer.yoffset, 0));
                //line.points[p] = { x: x, y: y };
                line.points[p] = MapMath.MoveAndRotatePoint(x, y, thislayer.xoffset, thislayer.yoffset, 0);
            }
            AllLines.push(line);
            console.log("    line extracted: %j", line);
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
          console.log("  COMPARING LINES: %j and %j", line1, line2);
        const intersectionpoint = MapMath.GetIntersectionPoint(line1, line2);
        let intx = intersectionpoint.x; let inty = intersectionpoint.y;
        if (intersectionpoint.x !== null && intersectionpoint.y !== null) {
            let rightanglepointsets = MapMath.GetRightAnglePoints(line1, line2, intersectionpoint, space) 
            for (let r=0; r < rightanglepointsets.length; r++) {
                console.log("    RIGHT ANGLE POINTS: %j", rightanglepointsets[r]);
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

function AddBackgroundColor(width, height, x, y, backcolor="#ffffff", id="backgroundcolor") {
    return  { 
        name: "rect", 
        type: "element",
        attributes: {
            id: id,
            x: x,
            y: y,
            width: width, 
            height: height, 
            fill: backcolor,
        }
    }
}


/*
let parent = {"id":"dresser-mag","title":"2023 Dresser Survey.","instructions":["addimage images/dresser.jpg"]}, 
let child = {"id":"dresser-true","parentid":"dresser-mag","magdecl":"-11,43"}
let merged = mergeLayers(parent, child);
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

function createLayerMap(Layers, copyobj=false) {
    const LayerMap = new Map();
    for (let layer of Layers) {
        if (layer && layer.id) {
            if (copyobj) {
                LayerMap.set(layer.id, JSON.parse(JSON.stringify(layer)));
            } else {
                LayerMap.set(layer.id, layer);
            }
        } 
    }
    return LayerMap;
}

function mergeParentsAndChildren(Layers, defaults) {
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
        child = mergeLayers(defaults, child);
        mergedLayers.push(child);
    }

    return mergedLayers; // Return the modified array
}

*/



function getLayerCopybyID(layerid, FileLayersMap, CompiledLayerMap) {
    console.log("getLayerCopybyID, layerid: %s", layerid);
    let layer = FileLayersMap.get(layerid);
    if (!layer) { layer = CompiledLayerMap.get(layerid); }
    if (layer) { return JSON.parse(JSON.stringify(layer));}
    console.log("didn't find layer: %s", layerid);
    return null;
}


function setRelativeLayerOffsets (layer1, alignpoint1, layer2, alignpoint2) {
    // force both layers to be at scale1 for calculations to be consistent
    let scale1 = parseFloat(layer1.scale);
    let scale2 = parseFloat(layer2.scale);
    
    let p1x = parseFloat(alignpoint1.x); p1x = p1x * scale1; 
    let p1y = parseFloat(alignpoint1.y); p1y = p1y * scale1;
    let p2x = parseFloat(alignpoint2.x); p2x = p2x * scale2;
    let p2y = parseFloat(alignpoint2.y); p2y = p2y * scale2;
    
    // convert back to existing layer scale to allow value on group to be used instead
    let xdiff = MapMath.rounddown((p2x - p1x) * 1/scale1);
    let ydiff = MapMath.rounddown((p2y - p1y) * 1/scale1);

    layer1.xoffset = parseFloat(layer1.xoffset) + xdiff;
    layer1.yoffset = parseFloat(layer1.yoffset) + ydiff;

    return layer1;
}

function AlignLayerPoints (FileLayersMap, Instruction, CompiledLayerMap) {
    let [layer1id, point1id, layer2id, point2id] = splitwords(Instruction);

    let layer1 = getLayerCopybyID(layer1id, FileLayersMap, CompiledLayerMap); 
    let point1 = MapLayers.getLayerPointCoords(layer1, point1id); 

    let layer2 = getLayerCopybyID(layer2id, FileLayersMap, CompiledLayerMap); 
    let point2 = MapLayers.getLayerPointCoords(layer2, point2id); 

    // move layer2 so that point2 is centered on point1
    layer1 = setRelativeLayerOffsets(layer1, point1, layer2, point2);
    FileLayersMap.set(layer1id, layer1);
    return FileLayersMap;
}

// alignlayerpointsandscale 1980-schlieder-true schlieder-pointb schlieder-pointc 1869-true 2,2 3,2 
function AlignLayerPointsAndScale (FileLayersMap, Instruction, CompiledLayerMap) {
    let [layer1id, point1id, point2id, layer2id, point3id, point4id] = splitwords(Instruction);

    let layer1 = getLayerCopybyID(layer1id, FileLayersMap, CompiledLayerMap); 
    let point1 = MapLayers.getLayerPointCoords(layer1, point1id); 
    let point2 = MapLayers.getLayerPointCoords(layer1, point2id); 

    let layer2 = getLayerCopybyID(layer2id, FileLayersMap, CompiledLayerMap); 
    let point3 = MapLayers.getLayerPointCoords(layer2, point3id);
    let point4 = MapLayers.getLayerPointCoords(layer2, point4id);
    
    let line1 = {}; line1.points = [point1, point2];
    let line2 = {}; line2.points = [point3, point4];
    let ratio = MapMath.GetRatioOfLineLengths(line1, line2); 
    layer1.scale *= ratio;
    console.log("SET RATIO: %s", ratio);
    
    // move layer1 so that point1 is centered on point2
    layer1 = setRelativeLayerOffsets(layer1, point1, layer2, point3);
    //layer1.xoffset = -layer1.xoffset;
    //layer1.yoffset = -layer1.yoffset; 

    // layer1.xoffset = 0;layer1.yoffset = 0;
    console.log("");
    console.log("layer1.xoffset: %s, layer1.yoffset: %s", layer1.xoffset, layer1.yoffset);
    console.log("");


    FileLayersMap.set(layer1id, layer1);
    return FileLayersMap; 
}



function moverotatescalepoint(layer, point, printscale=1) {
    printscale = parseFloat(printscale);
    console.log("");
    console.log("!!!!!! layer id: %s", layer.id);
    scale = parseFloat(layer.scale) / printscale || 1;
    console.log("layer scale: %s, printscale: %s, initial x: %s, initial y: %s", layer.scale, printscale, point.x, point.y);
    let x = parseFloat(point.x) * scale;
    let y = parseFloat(point.y) * scale;
    console.log("scaled x: %s, scaled y: %s", x, y);
    console.log("layer xoffset: %s, layer yoffset: %s", layer.xoffset, layer.yoffset);
    let xoffset = parseFloat(layer.xoffset) * scale;
    let yoffset = parseFloat(layer.yoffset) * scale;
    console.log("scaled xoffset: %s, scaled yoffset: %s", xoffset, yoffset);
    let rotpoint = MapMath.MoveAndRotatePoint(x, y, xoffset, yoffset, layer.rotate);
    console.log("final x: %s, final y: %s", rotpoint.x, rotpoint.y);
    point.x = rotpoint.x; point.y = rotpoint.y;
    return point;
}

function compileRules(LayerState, FileLayersMap, printscale=1) {
    printscale = parseFloat(printscale);
    // invert existing scale layer (1 by default) to get back to consistent scale 1
    let AllRules = [];
    if (LayerState.rules && LayerState.rules.length) {
        for (let i=0; i < LayerState.rules.length; i++) {

            let thisrule = LayerState.rules[i];

            // scale the point relative to the appropriate layer 
            let startpoint = thisrule.points[0];
            let startpointlayer = LayerState;
            if (startpoint.layerid && startpoint.layerid != LayerState.id) { 
                startpointlayer = FileLayersMap.get(startpoint.layerid); 
                if (startpointlayer) { startpoint = moverotatescalepoint(startpointlayer, startpoint, printscale); } 
            } 

            let endpoint = thisrule.points[1];
            console.log("endpoint before : %o", endpoint);
            let endpointlayer = LayerState;
            console.log("endpoint.layerid: %s, LayerState.id: %s", endpoint.layerid, LayerState.id);
            if (endpoint.layerid && endpoint.layerid != LayerState.id) { 
                console.log("going into another layer");
                endpointlayer = FileLayersMap.get(endpoint.layerid);
                if (endpointlayer) { endpoint = moverotatescalepoint(endpointlayer, endpoint, printscale); }
            }
            console.log("endpoint after: %o", endpoint);
            // endpoint.scale = endpointlayer.scale;

            // need to make sure that distances, bearings and labels are adjusted with updated layer information
            let cartstartpoint = MapMath.SVGCoordstoCartCoords(startpoint);
            let cartendpoint = MapMath.SVGCoordstoCartCoords(endpoint);

            // (I think) startpoint and endpoint should now both be at the same scale, drawing scale == 1
            let dist = MapMath.GetDistanceFromPoints(cartstartpoint.x, cartstartpoint.y, cartendpoint.x, cartendpoint.y);
            thisrule = MapMath.GetAllDistanceInfo(dist + " feet", thisrule);

            let angle = MapMath.GetAngleFromPoints(cartstartpoint.x, cartstartpoint.y, cartendpoint.x, cartendpoint.y);
            let az = MapMath.AzimuthtoSVG(angle);
            thisrule = MapMath.GetAllBearingInfo("a " + az + " z", 0, 0, thisrule);

            thisrule = MapLayers.SetLineLabel(thisrule);

            // get midpoint
            let midpoint = MapMath.GetEndPoint(cartstartpoint.x, cartstartpoint.y, angle,  dist/2);
            midpoint = MapMath.CartCoordstoSVGCoords(midpoint);
            thisrule.points[2] = midpoint;

            let rulewidth = LayerState.linewidth / 2;
            let dashlen = rulewidth * 2;
            let dasharray = dashlen + "," + dashlen; 

            let pathelement = SVGHelper.CreateRulePathElement(startpoint.x, startpoint.y, endpoint.x, endpoint.y, rulewidth, dasharray);
            pathelement.attributes["stroke"] = LayerState.color;
            AllRules.push(pathelement);

            let xlabeloffset = thisrule.dx || 0;
            let ylabeloffset = thisrule.dy || 2;

            let lineangle = parseFloat(thisrule.lineangle);
            let textangle = -lineangle; 
            if (lineangle > 90 && lineangle < 270) { textangle = MapMath.GetBackAngle(textangle); }
            let textelement = SVGHelper.CreateTextElement(thisrule.label, midpoint.x, midpoint.y, xlabeloffset, ylabeloffset, textangle, LayerState.fontsize); 
            textelement.attributes["fill"] = LayerState.color; 
            AllRules.push(textelement);
        } 
    }
    return AllRules;
}

/*
function setRelativeLayerOffsets (layer1, alignpoint1, layer2, alignpoint2) {
    // force both layers to be at scale1 for calculations to be consistent
    let scale1 = parseFloat(layer1.scale);
    let scale2 = parseFloat(layer2.scale);
    
    let p1x = parseFloat(alignpoint1.x); p1x = p1x * scale1; 
    let p1y = parseFloat(alignpoint1.y); p1y = p1y * scale1;
    let p2x = parseFloat(alignpoint2.x); p2x = p2x * scale2;
    let p2y = parseFloat(alignpoint2.y); p2y = p2y * scale2;
    
    // convert back to existing layer scale to allow value on group to be used instead
    let xdiff = MapMath.rounddown((p2x - p1x) * 1/scale1);
    let ydiff = MapMath.rounddown((p2y - p1y) * 1/scale1);

    layer1.xoffset = parseFloat(layer1.xoffset) + xdiff;
    layer1.yoffset = parseFloat(layer1.yoffset) + ydiff;

    return layer1;
}
*/


function transformGroup(groupsvg, scale) {
    let transform = `scale(${scale}) rotate(${groupsvg.rotate}) translate(${groupsvg.xoffset} ${groupsvg.yoffset})`;
    groupsvg.attributes.transform = transform;
    return groupsvg;
}

function setLayerScale(LayerState, scale=1) {
    // if a scale is specified in the layer definition, force it, set otherwise
    console.log("");
    console.log("Got scale: %s", scale);
    console.log("LayerState.id: %s, LayerState.scale: %s", LayerState.id, LayerState.scale);
    console.log("LayerState.xoffset: %s, LayerState.yoffset: %s", LayerState.xoffset, LayerState.yoffset);
    scale = MapMath.rounddown(parseFloat(LayerState.scale) * parseFloat(scale));
    LayerState.scale = scale;
    LayerState.svg = transformGroup(LayerState.svg, scale);
    console.log("Scale set: %s", scale);
    return LayerState;
} 

function GetPaperSizes (size="letter",orientation="portrait") {
    const portraitsizes = {"letter":  {width: 8.5, height: 11},
    					    "legal":   {width: 8.5, height: 14},
                            "tabloid": {width: 11, height: 17},
                           };
    let dims =  {width: 0, height: 0};
    if (portraitsizes[size]) {
        dims = portraitsizes[size];
        if (orientation != "portrait") {
            let tempwidth = dims.width;
            dims.width = dims.height;
            dims.height = tempwidth;
        }
    } else { console.log("No paper size: %s .", size); }
    return dims;
}

function GetPrintDimensions (finalwidthinches, finalheightinches, margininches){
    if (isNaN(finalwidthinches) && isNaN(finalheightinches)) {
        let dims = GetPaperSizes(finalwidthinches, finalheightinches);
        finalwidthinches = dims.width;
        finalheightinches = dims.height;
    } else {
        finalwidthinches = parseFloat(finalwidthinches);
        finalheightinches = parseFloat(finalheightinches);
    }
    return [finalwidthinches, finalheightinches]; 
}

function GetPrintScale (bbox, finalwidthinches, finalheightinches, margininches, printdpi) {
    margininches = parseFloat(margininches);
    finalwidthinches -= margininches * 2;
    finalheightinches -= margininches * 2 ;
    
    let currentWidthInches = finalwidthinches;
    let currentHeightInches = finalheightinches;
    if (bbox.minx !== Number.MAX_VALUE || bbox.miny !== Number.MAX_VALUE || bbox.maxx !== Number.MIN_VALUE || bbox.maxy !== Number.MIN_VALUE) {
        currentWidthInches = (bbox.maxx - bbox.minx) / printdpi;
        currentHeightInches = (bbox.maxy - bbox.miny) / printdpi;
        currentWidthInches += margininches * 2;
        currentHeightInches += margininches * 2;
    }

    const widthRatio = finalwidthinches / currentWidthInches;
    const heightRatio = finalheightinches / currentHeightInches;

    // Choose the smaller ratio to ensure the bounding box fits within the desired dimensions
    let scale = Math.min(widthRatio, heightRatio);

    // Check if the resulting bounding box exceeds the desired dimensions
    if (currentWidthInches * scale > finalwidthinches || currentHeightInches * scale > finalheightinches) {
        // Scale down to fit within the desired dimensions
        const scaleToFitWidth = finalwidthinches / currentWidthInches;
        const scaleToFitHeight = finalheightinches / currentHeightInches;
        scale = Math.min(scaleToFitWidth, scaleToFitHeight);
  }

  return MapMath.rounddown(scale);
}

exports.GenerateAllSVGFiles = function (ConfigFile="./maps.yaml", outputdir="./maps") {

    let MappingConfig = {};
    try { MappingConfig= yaml.load(fs.readFileSync(ConfigFile, "utf8")); } catch (error) { console.error(error); }

    let allLayers = [];
    let allFiles = [];
    let filescreatedaccum = [];
    let copiedimagesaccum = [];
    if (MappingConfig?.include ?? null) {
        for (let i=0; i < MappingConfig.include.length; i++) {
            let tempConfig = MappingConfig.include[i];
            let tempMappingConfig = {};
            try { tempMappingConfig = yaml.load(fs.readFileSync(tempConfig, "utf8")); } catch (error) { console.error(error); }
            if (tempMappingConfig.layers) { allLayers = tempMappingConfig.layers.concat(allLayers); }
            if (tempMappingConfig.files) { allFiles = tempMappingConfig.files.concat(allFiles); }
        }
    } 
    if (MappingConfig.layers) { allLayers = allLayers.concat(MappingConfig.layers); }
    if (MappingConfig.files) { allFiles = allFiles.concat(MappingConfig.files); }
    const AllLayersConfigMap = MapMath.createMapFromArray(allLayers, id="id", true); // original layer configs to use later 

    // prepare all layers before constructing the file
    AllOrderedLayers = MapMath.cascadeProperties(allLayers, MapLayers.LayerDefaults);
    const CompiledLayerMap = MapLayers.CompileAllMapLayers(AllOrderedLayers);

    console.log("added all layers?");
    let FileDefaults = {outputformats: "svg",
                        backcolor:  "#ffffff",
                        printsize: "letter portrait .25 300",
                       };
    allFiles = MapMath.cascadeProperties(allFiles, FileDefaults);

    for (f=0; f < allFiles.length; f++) {
        let FileLayersMap = new Map();

        BaseLayer = MapLayers.LayerDefaults;
        BaseLayer.grids = [];
        BaseLayer.svg = SVGHelper.CreateGroupElement("base");
        BaseLayer.minx = Number.MAX_VALUE;
        BaseLayer.miny = Number.MAX_VALUE;
        BaseLayer.maxx = Number.MIN_VALUE;
        BaseLayer.maxy = Number.MIN_VALUE;

        let FileConfig = allFiles[f];
        let FileInstructions = FileConfig.instructions || [];
        for (i=0; i < FileInstructions.length; i++) {
            let Instruction = FileInstructions[i];
            console.log("Initial instruction: " + Instruction);
            let File
            let args = splitwords(Instruction);
            let Command = args.shift();
            Instruction = args.join(" ");
            switch (Command) {
                case "addlayer":
                    let [layerid, color, xoffset, yoffset, scale, rotate] = splitwords(Instruction);
                    let layerfound = CompiledLayerMap.get(layerid);
                    if (layerfound) {
                        // assign a deep copy of the compiled layer that can be modified as needed
                        // within the scope of this file only
                        let layercopy = JSON.parse(JSON.stringify(layerfound));
                        if (color) { layercopy.color = color; }
                        if (xoffset) { layercopy.xoffset = parseFloat(xoffset); }
                        if (yoffset) { layercopy.yoffset = parseFloat(yoffset); }
                        if (scale) { layercopy.scale = parseFloat(scale); }
                        if (rotate) { layercopy.rotate = parseFloat(rotate); }
                        FileLayersMap.set(layercopy.id, layercopy);
                    } 
                    break;
                case "addcompass":
                    BaseLayer.compass = MapLayers.AddCompass(Instruction);
                    break;
                case "addgrid":
                    BaseLayer.grids.push(Instruction);
                    break;
                case "alignlayerpoints": 
                    FileLayersMap = AlignLayerPoints(FileLayersMap, Instruction, CompiledLayerMap);
                break;
                case "alignlayerpointsandscale": 
                    FileLayersMap = AlignLayerPointsAndScale(FileLayersMap, Instruction, CompiledLayerMap);
                break;
                default:
                    console.error("File command: " + Command + ", with instruction: " + Instruction + " is not valid."); 
            }
        }

        /*
         * ORDER OF LAYER ADDITION TO SVG:
         *
         *     1. any images in insertion order
         *     2. any grids
         *     3. adjust margins 
         *     4. right angle symbols
         *     5. drawn maps in insertion order
         *     6. background color
         *  
         * Baselayer scale =1 
         * individual layers within BaseLayer are scaled (or not), 
         * but baselayer still tracks overall min/max x/y coords at scale, across all layers 
         *  
         * coded so that in many instances unshifting elements under/before all others will be done
         * instead of pushing elements above/under all others
         *
        */
        // let scale1box = {minx:0, miny:0, maxx:0, maxy:0};
       
        // generate SVG markup for all layers and calculate bounding box
        // map should be in correct/insertion order
        // layers with images should not scale with drawings
        // add drawn layers now and collect image layers for addition futher below
        //let imagelayeraccum = SVGHelper.CreateGroupElement("images");
        let imagesBBox = {minx:0, miny:0, maxx:0, maxy:0}; 
        let imagelayeraccum = [];
        let drawinglayersaccum = [];
        for (let [layerid, thislayer] of FileLayersMap) {
            thislayer = SVGHelper.GenerateSVG(thislayer);  
            thislayer = SVGHelper.GetElementsBoundingBox(thislayer);
            //thislayer = SVGHelper.ScaleElementsBoundingBox(thislayer);
            if (thislayer.images && thislayer.images.length > 0) { 
                for (let i=0; i < thislayer.images.length; i++) { copiedimagesaccum.push(path.join(outputdir, thislayer.images[i].href)); }
                imagelayeraccum.push(thislayer);
                imagesBBox.minx = Math.min(thislayer.minx, imagesBBox.minx);
                imagesBBox.miny = Math.min(thislayer.miny, imagesBBox.miny);
                imagesBBox.maxx = Math.max(thislayer.maxx, imagesBBox.maxx);
                imagesBBox.maxy = Math.max(thislayer.maxy, imagesBBox.maxy);
            } else {
                // get the max encompasing bounding box for all drawings at scale 1 
                // to figure out optimal scaling subsequently
                drawinglayersaccum.push(thislayer);
                BaseLayer.minx = Math.min(thislayer.minx, BaseLayer.minx);
                BaseLayer.miny = Math.min(thislayer.miny, BaseLayer.miny);
                BaseLayer.maxx = Math.max(thislayer.maxx, BaseLayer.maxx);
                BaseLayer.maxy = Math.max(thislayer.maxy, BaseLayer.maxy);
            }
            FileLayersMap.set(layerid, thislayer);
        }
        
        // if we have only an image and no drawings, then basic dimensions will not have been calculated from the SVG,
        // so calculate them based on print size only, centered on origin
        //if (width == 0 || height == 0) { 
        if (BaseLayer.minx === Number.MAX_VALUE || BaseLayer.miny === Number.MAX_VALUE || 
            BaseLayer.maxx === Number.MIN_VALUE || BaseLayer.maxy === Number.MIN_VALUE) {
                BaseLayer.minx = imagesBBox.minx; 
                BaseLayer.miny = imagesBBox.miny;
                BaseLayer.maxx = imagesBBox.maxx;
                BaseLayer.maxy = imagesBBox.maxy;
                //scale = GetPrintScale(imagesBBox, finalwidthinches, finalheightinches, margin, printdpi);
        }

        // optimize output for drawn layers
        let [finalwidthinches, finalheightinches, margininches, printdpi] = splitwords(FileConfig.printsize);
        margininches = parseFloat(margininches);
        printdpi = parseFloat(printdpi);
       
        // additional margin for grid labels
        let gridmarginpixels = BaseLayer.fontsize * 4 ; 
        margininches += gridmarginpixels/printdpi; 

        [finalwidthinches, finalheightinches] = GetPrintDimensions(finalwidthinches, finalheightinches, margininches);
        let scale = GetPrintScale(BaseLayer, finalwidthinches, finalheightinches, margininches, printdpi);
       
        // want to make calculations but not trigger setting scale at group layer 
        // only the group layer children of BaseLayer are scaled in the SVG output 
        BaseLayer.scale = scale;
        BaseLayer = SVGHelper.ScaleElementsBoundingBox(BaseLayer);


        let rulesaccum = [];
        // place collected images under/before already added drawn layers
        if (imagelayeraccum && imagelayeraccum.length > 0) {
            let imagesgroup = SVGHelper.CreateGroupElement("images");
            for (let c=0; c < imagelayeraccum.length; c++) {
                //console.log("image layerid: %s, starting scale: %s", imagelayeraccum[c].id, imagelayeraccum[c].scale);
                if (! drawinglayersaccum || drawinglayersaccum.length == 0) {
                    // if there are no drawings, force images to scale 1 so
                    // images will be optimized for print scale later
                    imagelayeraccum[c].scale = 1;
                }

                imagelayeraccum[c].svg.children.push(compileRules(imagelayeraccum[c], FileLayersMap, scale));
                console.log("**** image layer id: %s, starting scale: %s", imagelayeraccum[c].id, imagelayeraccum[c].scale);
                imagelayeraccum[c] = setLayerScale(imagelayeraccum[c], scale);
                FileLayersMap.set(imagelayeraccum[c].id, imagelayeraccum[c]);
                imagesgroup.children.push(imagelayeraccum[c].svg);

                // add any image layer rules, point coords will already be scaled correctly, so add to unscaled BaseLayer        
                // if (rules && rules.length > 0) { rulesaccum = rulesaccum.concat(rules); }

            }
            BaseLayer.svg.children.push(imagesgroup); 
        }
 

        // add grid 
        if (BaseLayer.grids && BaseLayer.grids.length) { 
            BaseLayer.svg.children.push(GetGrids(BaseLayer, scale, gridmarginpixels)); 
            let addmarginpixels = MapMath.rounddown(gridmarginpixels * scale * 2);
            BaseLayer.minx -= addmarginpixels; 
            BaseLayer.miny -= addmarginpixels;
            BaseLayer.maxx += addmarginpixels;
            BaseLayer.maxy += addmarginpixels; 
        }
       
        // add compass
        if (BaseLayer.compass) {
            let compass = SVGHelper.GetCompassGroup(BaseLayer.compass); 
            compass = transformGroup(compass, scale);
            BaseLayer.svg.children.push(compass); 
        }
        
        // add right angle signifiers
        let AllLines = extractLinesAndPaths(FileLayersMap);
        let space = 10;
        let rapathgroup = {};
        rapathgroup = getRightAnglePaths(AllLines, space); 
        rapathgroup = transformGroup(rapathgroup, scale);
        BaseLayer.svg.children.push(rapathgroup);

        // add drawn layers on top
        for (let l=0; l < drawinglayersaccum.length; l++) {
            drawinglayersaccum[l].svg.children.push(compileRules(drawinglayersaccum[l], FileLayersMap, scale));
            drawinglayersaccum[l] = setLayerScale(drawinglayersaccum[l], scale);
            //if (rules && rules.length > 0) { rulesaccum = rulesaccum.concat(rules); }
            BaseLayer.svg.children.push(drawinglayersaccum[l].svg); 
        }

        // add all rules accumulated from image and drawing layers
        //if (rulesaccum && rulesaccum.length > 0) { BaseLayer.svg.children.push(rulesaccum); }

        // add legend
        let legendpadding = BaseLayer.fontsize * 10 ; 
        let [legendgroup, addheight] = AddLegend(BaseLayer, drawinglayersaccum, legendpadding);
        // legend placed directly at scaled coordinates, so adjust xoffset and yoffset separately to scale consistently 
        legendoffsetx = MapMath.rounddown(legendgroup.xoffset/scale);
        legendoffsety = MapMath.rounddown(legendgroup.yoffset/scale);
        legendgroup.attributes.transform = `scale(${scale}) translate(${legendoffsetx} ${legendoffsety})`;
        BaseLayer.svg.children.push(legendgroup);
        BaseLayer.maxy += addheight * scale;

        let width = MapMath.rounddown(BaseLayer.maxx - BaseLayer.minx);
        let height = MapMath.rounddown(BaseLayer.maxy - BaseLayer.miny);
        BaseLayer.minx = MapMath.rounddown(BaseLayer.minx); BaseLayer.miny = MapMath.rounddown(BaseLayer.miny);
        BaseLayer.svg.children.unshift(AddBackgroundColor(width, height, BaseLayer.minx, BaseLayer.miny, FileConfig.backcolor));

        // compile final SVG 
        let svg =  SVGHelper.CreateSVGElement("base.svg", dir="./"); 
        svg.attributes.width = width;
        svg.attributes.height = height;
        svg.attributes.viewBox = [BaseLayer.minx, BaseLayer.miny, width, height].join(" ");  

        svg.children.push(BaseLayer.svg);
    
        // output all files
        let filebasename = FileConfig.id;
        // SVG files MUST be created, as they are the basis for all other files, however, it doesn't have to be kept...
        let svgfile = filebasename + ".svg";
        SVGHelper.SaveSVGJSON (svg, svgfile , outputdir); 
        if (FileConfig.outputformats.includes("svg")) { filescreatedaccum.push(path.join(outputdir, svgfile)); }
        if (FileConfig.outputformats.includes("png")) { 
            savePNG(filebasename, outputdir, printdpi); 
            filescreatedaccum.push(path.join(outputdir, filebasename + ".png"));
        }

        if (FileConfig.outputformats.includes("md") || FileConfig.outputformats.includes("html")) { 
            let metaHTML = MapMeta.CompileFileMetadata(FileConfig, FileLayersMap, BaseLayer.grids);
            if (FileConfig.outputformats.includes("html")) { 
                let mapimage = stringify(svg);
                let imagefilepath = path.join(outputdir, filebasename + ".png"); // prefer png if it exists 
                if (fs.existsSync(imagefilepath)) { mapimage = "<img src=\"${imagefilepath}\"/>"; } 

                let htmlcontent = "<figure>" + mapimage + metaHTML + "</figure>";
                FileHelper.SaveText(MapMeta.FormatHTML(filebasename, htmlcontent), filebasename + ".html", outputdir); 
                filescreatedaccum.push(path.join(outputdir, filebasename + ".html"));
            } 
            if (FileConfig.outputformats.includes("md")) {
                let mdtext = MapMeta.FormatMD(FileConfig, FileLayersMap, AllLayersConfigMap, svg, metaHTML);
                FileHelper.SaveText(mdtext, filebasename + ".md", outputdir); 
                filescreatedaccum.push(path.join(outputdir, filebasename + ".md"));
            }
        }
    }

    RemoveOrphanFiles(filescreatedaccum, outputdir);
    RemoveOrphanFiles(copiedimagesaccum, path.join(outputdir, "images"));
    process.exit();
}
