
const fs = require("fs");
const path = require("path");
const { parseSync, stringify } = require("svgson");
const sizeOf = require("image-size")
const FileHelper = require("./FileHelper");
const MapMath = require("./MapMath");
const splitwords = MapMath.splitwords;
const logall = MapMath.logall;


function GetSVGJSON (svgfile, dir) {
    let svgtext = FileHelper.GetText(svgfile, dir);
    return parseSync(svgtext); 
}

function CreateSVGElement() {
    return { 
        name:    "svg", 
        type:    "element",
        attributes: {},
        children: []
        };
}


function CreateSVGBaseGroup (scale=1) {
    let basegroup = CreateGroupElement("base", 0, scale);
    basegroup.attributes["stroke-linecap"] = "round"; 
    return basegroup;
}


function SaveSVGJSON (svg, svgfile, dir) {
    FileHelper.SaveText(stringify(svg), svgfile, dir); 
    return;
}

/*
function FindBaseGroup(svg) {
    let basegroup = CreateBaseLayer(); 
    let bgindex = 0;
    // basegroup is second and last direct child of SVG, after STYLE element
    for (let g=0; g < svg.children.length; g++) { 
        let tempbasegroup = svg.children[g];
        if (tempbasegroup.name =="g" && tempbasegroup.attributes.id == "base") {
            basegroup = tempbasegroup;
            bgindex = g;
        }
    }
    return [basegroup, bgindex];
}
*/

function GetImageDimensions(imagepath) {
    let [width, height] = [0,0];
    if (fs.existsSync(imagepath)) {
        const dimensions = sizeOf(imagepath);
        console.log("IMAGE: %s, DIMENSIONS: %j", imagepath, dimensions);
        width = dimensions.width;
        height = dimensions.height;
    } else {
        console.error("Cannot find file: " + imagepath);
    }
    return [width, height];
}


function CreateCircleElement(x, y, r) {
    return  { 
        name: "circle", 
        type: "element",
        attributes: {
            cx: x, 
            cy: y, 
            r: r,
        }
    }
}

function CreatePathElement(x1, y1, x2, y2) {
    return { 
        name: "path", 
        type: "element", 
        attributes: {
            d: "M " + x1 + " " + y1 + " L " + x2 + " " + y2,
        },
    }
}

function CreateLineElement(x1, y1, x2, y2) {
    return { 
        name: "line", 
        type: "element", 
        attributes: {
            x1: x1,
            y1: y1,
            x2: x2,
            y2: y2,
        },
    }
}

function CreateRulePathElement(x1, y1, x2, y2, linewidth=1, dash="none") {
    let pathelement = CreatePathElement(x1, y1, x2, y2);
    pathelement.attributes["stroke-width"] = linewidth; 
    pathelement.attributes["stroke-dasharray"] = dash; 
    return pathelement;
}

function calculateRotatedTextLength(text, fontsize=6, rotatedegrees = 0, characterWidth = 0.6) {
    const numchars = text.length;
    const rotateradians = MapMath.degstorads(rotatedegrees);  
    const width = Math.abs(Math.cos(rotateradians)) * fontsize * numchars * 0.6;
    return MapMath.rounddown(width);
}


function CreateTextElement(label, x, y, dx=4, dy=4, relangle=0, forecolor="black", fontsize=6, textanchor="middle", charwidth=0.6) {
    let textLength = calculateRotatedTextLength(label, parseFloat(fontsize), parseFloat(relangle), parseFloat(charwidth));
    x = parseFloat(x); y = parseFloat(y); dx = parseFloat(dx); dy = parseFloat(dy);
    x = x;
    y = y;
    return  { 
        name: "text", 
        type: "element", 
        attributes: {
            lineangle: relangle,
            // transform: "translate(" + x + "," + y + ") rotate(" + relangle + ")",
            x: x + dx,
            y: y + dy,
            textLength: textLength, 
            transform: "rotate(" + relangle + " " + x + " " + y + ")",
            fill: forecolor,
            stroke: "transparent",
            "stroke-width": 0,
            "font-family": "Roboto, sans-serif",
            "font-size": fontsize , 
            "text-anchor":  textanchor,
            "dominant-baseline":   "mathematical",
        },
        children: [{type: "text", value: label.toUpperCase()}],
    }
}

// all images are centered initially on 0,0
// image should be rotated 90 by default to account for -90
// rotation of drawing objects so drawn angles match compass bearings
function CreateImageElement(image, rotate) {
    if (image.width == 0 || image.height == 0) {
        [image.width, image.height] = GetImageDimensions(image.href);
    }
    let x = (image.x) ? image.x : image.width / -2;
    let y = (image.y) ? image.y : image.height / -2;
    return { 
        name: "image", 
        type: "element",
        attributes: {
            href: image.href, 
            x: x,
            y: y,
            width: image.width,
            height: image.height,
            transform: "rotate(" + rotate + ")",
        }
    };
}






/*
function rotateBoundingBox(LayerState, angle = -90) {
  // Convert the angle from degrees to radians
  const angleRadians = MapMath.degstorads(angle);
  const anglesin = Math.sin(angleRadians);
  const anglecos = Math.cos(angleRadians);

  // Calculate the rotated coordinates of the bounding box corners
  const x1 = LayerState.minx * anglecos - LayerState.miny * anglesin;
  const y1 = LayerState.minx * anglesin + LayerState.miny * anglecos;
  const x2 = LayerState.maxx * anglecos - LayerState.miny * anglesin;
  const y2 = LayerState.maxx * anglesin + LayerState.miny * anglecos;
  const x3 = LayerState.minx * anglecos - LayerState.maxy * anglesin;
  const y3 = LayerState.minx * anglesin + LayerState.maxy * anglecos;
  const x4 = LayerState.maxx * anglecos - LayerState.maxy * anglesin;
  const y4 = LayerState.maxx * anglesin + LayerState.maxy * anglecos;

  // Calculate the new bounding box coordinates and dimensions
  LayerState.minx = MapMath.rounddown(Math.min(x1, x2, x3, x4));
  LayerState.miny = MapMath.rounddown(Math.min(y1, y2, y3, y4));
  LayerState.maxx = MapMath.rounddown(Math.max(x1, x2, x3, x4));
  LayerState.maxy = MapMath.rounddown(Math.max(y1, y2, y3, y4));

  return LayerState;
}
*/


function CreateGroupElement(id, rotate=0, scale=1, xoffset=0, yoffset=0, margin=0, forecolor="black", linewidth=2, backcolor="transparent") {
    let transform = "rotate(0) translate(" + xoffset + " " + yoffset + ")";
    if (scale) { transform += " scale(" + scale + ")"; }  
    let g = { 
        name:    "g", 
        type:    "element",
        rotate:  rotate,
        xoffset: xoffset,
        yoffset: yoffset,
        scale:   scale,
        margin:  margin, 
        attributes: { 
            id:                     id, 
            transform:              transform,  
            fill:                   backcolor,
            stroke:                 forecolor,
            "stroke-width":         linewidth,
        },
        children: [],
    }
    return g;
}

function ScaleElementsBoundingBox(LayerState, baserotate=0) {
    console.log(" ");
    console.log("   *** Layer ID: %s, xoffset: %s, yoffset: %s", LayerState.id, LayerState.xoffset, LayerState.yoffset);
    // add a default layer margin
    const margin = 12;
    LayerState.minx -= margin;
    LayerState.miny -= margin;
    LayerState.maxx += margin;
    LayerState.maxy += margin;

    // rotate
    const rotate = (LayerState.rotate) ? parseFloat(LayerState.rotate) : 0;
    LayerState = MapMath.RotateBoundingBox(LayerState, baserotate + rotate);

    // offset 
    const xoffset = (LayerState.xoffset) ? parseFloat(LayerState.xoffset) : 0;
    const yoffset = (LayerState.yoffset) ? parseFloat(LayerState.yoffset) : 0;
    LayerState.minx += xoffset;
    LayerState.miny += yoffset;
    LayerState.maxx += xoffset;
    LayerState.maxy += yoffset;
    
    // scale
    // invert scale for images to counteract drawing scale
    // and bring image scale back to 1
    let scale = (LayerState.scale) ? parseFloat(LayerState.scale) : 1;

    if (LayerState.images && LayerState.images.length) { 
        let transformscale = 1 / scale;
        scale = 1;
        LayerState.scale = scale; 
        if (LayerState.svg.attributes.transform) {
            LayerState.svg.attributes.transform += " scale(" + transformscale + ")";
        } else {
            LayerState.svg.attributes.transform =  " scale(" + transformscale + ")";
        }
    } 
    LayerState.minx = LayerState.minx * scale;
    LayerState.miny = LayerState.miny * scale;
    LayerState.maxx = LayerState.maxx * scale;
    LayerState.maxy = LayerState.maxy * scale;
    
    // Return the maximum width and height as an object
    return LayerState;
}

function GetPointsFromPath(path) {
    let [x1,y1,x2,y2] = [0,0,0,0];
    if (path.name === "path") {
        const pathData = path.attributes.d;
        const pathCommands = pathData.split(" ");
        const firstCommand = pathCommands[0].toUpperCase();
        if (firstCommand === "M" && pathCommands.length >= 6) {
            x1 = parseFloat(pathCommands[1]) || 0;
            y1 = parseFloat(pathCommands[2]) || 0;
            x2 = parseFloat(pathCommands[4]) || 0;
            y2 = parseFloat(pathCommands[5]) || 0;
        }
    }
    if (path.name === "line") {
        x1 = path.attributes.x1 || 0; 
        y1 = path.attributes.y1 || 0; 
        x2 = path.attributes.x2 || 0; 
        y2 = path.attributes.y2 || 0; 
    }
    return [x1,y1,x2,y2];
}

// When an SVG has been completely written to, 
// dyamically set its width and height based on
// the final content of the elements contained.
// This function borrows heavily from sample code,
// so coding style is distinct from rest of code.
function GetElementsBoundingBox(LayerState) {
    //let bbox = null;

    let bbox = { minx: 0, miny: 0, maxx: 0, maxy: 0 };

    function updateBBox(child) {
        if (child.attributes) {
            let [minx, miny, maxx, maxy] = [0, 0, 0, 0];
            switch (child.name) {
                case "g":
                case "image":
                    // By default, SVG elements are rotated -90 degrees
                    // so that the coordinate system matches compass bearings
                    // the exception is images, which will essentially need to be
                    // rotated 90 degrees relative to the other SVG elements.
                    // So, to reconcile the two, we have to adjust the image values here
                    // image will be centered at 0,0, so half width and height will be negative
                    const width = parseFloat(child.attributes.width) || 0;
                    const height = parseFloat(child.attributes.height) || 0;
                    minx = width / -2;
                    miny = height / -2;
                    maxx = width / 2;
                    maxy = height / 2;
                    //let imagebbox =  rotateBoundingBox({minx: minx, miny: miny, maxx: maxx, maxy: maxy}, 90);
                    //minx = imagebbox.minx;
                    //miny = imagebbox.miny;
                    //maxx = imagebbox.maxx;
                    //maxy = imagebbox.maxy;
                    break;
                case 'circle':
                    const cx = parseFloat(child.attributes.cx) || 0;
                    const cy = parseFloat(child.attributes.cy) || 0;
                    const r = parseFloat(child.attributes.r) || 0;
                    minx = cx - r;
                    miny = cy - r;
                    maxx = cx + r;
                    maxy = cy + r;
                    break;
                case 'text':
                    let textcontent = child.children && child.children[0] && child.children[0].value ? child.children[0].value : '';
                    let numchars = textcontent.length;
                    if (numchars) {
                        // Approximate text width and height based on text length and font size
                        const fontsize = parseFloat(child.attributes['font-size']) || 6;
                        const lineangle = parseFloat(child.attributes.lineangle) || 0;
                        const lineanglerads = MapMath.degstorads(lineangle);
                      
                        // assume character width of 0.6
                        const width = Math.abs(Math.cos(lineanglerads)) * fontsize * numchars * 0.6;
                        const height = Math.abs(Math.sin(lineanglerads)) * fontsize;

                        dx = parseFloat(child.attributes.dx) || 0;
                        dy = parseFloat(child.attributes.dy) || 0;                     

                        minx = parseFloat(child.attributes.x) + dx || 0;
                        miny = parseFloat(child.attributes.y) + dy || 0;
                        maxx = minx + width || 0;
                        maxy = miny + height || 0;
                    }
                    break;
                case 'path':
                    // Handle paths constructed with the "M x y ..." format
                    let [px1,py1,px2,py2] = GetPointsFromPath(child);
                    minx = Math.min(px1, px2);
                    miny = Math.min(py1, py2);
                    maxx = Math.max(px1, px2);
                    maxy = Math.max(py1, py2);
                    break;
                case 'line':
                    let [lx1,ly1,lx2,ly2] = GetPointsFromPath(child);
                    minx = Math.min(lx1, lx2);
                    miny = Math.min(ly1, ly2);
                    maxx = Math.max(lx1, lx2);
                    maxy = Math.max(ly1, ly2);
                    break;
                default:
                    [minx, miny, maxx, maxy] = [0, 0, 0, 0];
                    break;
            } // end switch

            bbox.minx = Math.min(bbox.minx, minx);
            bbox.miny = Math.min(bbox.miny, miny);

            bbox.maxx = Math.max(bbox.maxx, maxx);
            bbox.maxy = Math.max(bbox.maxy, maxy);
        }

        if (child.children && child.children.length) {
            child.children.forEach(updateBBox);
        }
    }

    updateBBox(LayerState.svg);
    LayerState.minx = bbox.minx; 
    LayerState.miny = bbox.miny; 
    LayerState.maxx = bbox.maxx; 
    LayerState.maxy = bbox.maxy; 
    return LayerState;
}

function getCircleLabelOffsets(LayerState, thisstep, space) {
    let stepnum = parseInt(thisstep.num);
    let stepindex = stepnum -1;
    let nextstep = {};
    if (stepindex == LayerState.steps.length -1) {
        // last step will use first step as "next" step
        nextstep = LayerState.steps[0];
    } else {
        nextstep = LayerState.steps[stepindex+1];
    }
    return MapMath.GetFuzzyLabelOffset(thisstep.lineangle, nextstep.lineangle, space);
}


function GenerateSVG (LayerState) {
    // setting scale to 0 tells function not to set scale at all 
    // create group for this layer  
    let layergroup = CreateGroupElement(LayerState.id, LayerState.rotate,
                                    1, LayerState.xoffset, LayerState.yoffset, 
                                    parseFloat(LayerState.linewidth) * 10,
                                    LayerState.forecolor, LayerState.linewidth, LayerState.backcolor);
    
    // add all images
    if (LayerState.images && LayerState.images.length) {
        for (let i = 0; i < LayerState.images.length; i++) {
            let img = LayerState.images[i];
            layergroup.children.push(CreateImageElement(img, LayerState.rotate));
        }
    }

    if (LayerState.steps && LayerState.steps.length) {
        let r = parseFloat(LayerState.linewidth) * 2; 
        let fontsize = parseFloat(LayerState.fontsize);
        let labelpadding = r * 2;
        let dx = (LayerState.steps[0].points[0].dx) ? parseFloat(LayerState.steps[0].points[0].dx) : 0;
        let dy = (LayerState.steps[0].points[0].dy) ? parseFloat(LayerState.steps[0].points[0].dy) : labelpadding + fontsize;
        logall({dx},{dy},{r},{labelpadding});

        // circle drawing starting point 
        if (! LayerState.displayflags.includes("nosteppoints") && LayerState.steps[0]) {
            let [cx, cy] = [LayerState.steps[0].points[0].x, LayerState.steps[0].points[0].y] ;
            layergroup.children.push(CreateCircleElement(cx, cy, r));
            let labelpoint = getCircleLabelOffsets(LayerState, LayerState.steps[0], labelpadding); 
            layergroup.children.push(CreateTextElement(LayerState.steps[0].points[0].label, 
                                cx, cy, dx, dy, 0, LayerState.forecolor, fontsize));
        }
       
        // create steps (line and endpoint)
        for (let i = 0; i < LayerState.steps.length; i++) {
            // reset values
            r = parseFloat(LayerState.linewidth) * 2; 
            fontsize = parseFloat(LayerState.fontsize);
            labelpadding = r + 2;
            let [x1, y1] = [ LayerState.steps[i].points[0].x, LayerState.steps[i].points[0].y];
            let [x2, y2] = [ LayerState.steps[i].points[1].x, LayerState.steps[i].points[1].y];
            let [x3, y3] = [ LayerState.steps[i].points[2].x, LayerState.steps[i].points[2].y];
           
            // LINE
            layergroup.children.push(CreatePathElement(x1, y1, x2, y2));
            
            // LINE LABEL
            let [x, y] = [x3, y3];
            dx = (LayerState.steps[i].dx) ? LayerState.steps[i].dx : 0;
            dy = (LayerState.steps[i].dy) ? LayerState.steps[i].dy : 0;
            let lineangle = parseFloat(LayerState.steps[i].lineangle);
            let textangle = -lineangle; 
            let textlength = parseFloat(LayerState.steps[i].linelength);

            // minor adjustments to flip rotated text and slight line adjustments for edge cases 
            if (lineangle > 90 && lineangle < 270) { textangle = MapMath.GetBackAngle(textangle); }
            //if (lineangle == 90 ) { dx -= r; }
            //if (lineangle == 270) { dx += r; }

            if (LayerState.steps[i].label.length < 2) { textangle = 0; } 
            ({x, y} = MapMath.GetEndPoint(x, y, textangle - 90, r));
            layergroup.children.push(CreateTextElement(LayerState.steps[i].label, x, y, dx, dy, textangle, LayerState.forecolor, fontsize));
            
            // ENDPOINT CIRCLE AND LABEL
            dx = (LayerState.steps[i].points[1].dx) ? parseFloat(LayerState.steps[i].points[1].dx) : 0;
            dy = (LayerState.steps[i].points[1].dy) ? parseFloat(LayerState.steps[i].points[1].dy) : 0;
            textangle = 0;
            if (! LayerState.displayflags.includes("nosteppoints")) {
                // is this the endpoint of the first step? If so, increase circle size, and label spacing as this should be the "Place of Beginning"
                fontsize = LayerState.fontsize; 
                if (i==0) { 
                    r = r * 2; 
                    labelpadding = r + (LayerState.linewidth * 2 *2) ; 
                    fontsize = fontsize * 2; 
                }

                layergroup.children.push(CreateCircleElement(x2, y2, r));
                let circlelabel = LayerState.steps[i].points[1].label;
                let labelpoint = getCircleLabelOffsets(LayerState, LayerState.steps[i], labelpadding); 
                logall({lineangle},{circlelabel},{r},{labelpadding});
                // account for height of font in positive y adjustment
                if (labelpoint.y > 0) { labelpoint.y = labelpoint.y + LayerState.fontsize ; }
                layergroup.children.push(CreateTextElement(circlelabel, x2, y2, labelpoint.x, labelpoint.y, textangle, LayerState.forecolor, fontsize));
            }
        }
    }

    let rules = compileRules(LayerState);
    if (rules) { layergroup.children.push(rules); }
    LayerState.svg = layergroup; 
    return LayerState;
}

/*
 * original functions that are not cross-layer aware
 */
function DrawRightAngleSign(angle1, angle2, intersectionpoint, space=8) {
    // put this symbol past the point circle and calculate hypotenuse
    let sidedist = parseFloat(space); 
    let aveangle = MapMath.GetInsideAverageAngle(parseFloat(angle1), parseFloat(angle2));
    console.log(" Got these to draw: angela: %s, angle2: %s, aveangle: %s", angle1, angle2, aveangle);
    [vertexx, vertexy] = [parseFloat(intersectionpoint.x), parseFloat(intersectionpoint.y)];
    console.log(" Got these to draw: intersectionpoint.x: %s, intersectionpoint.y: %s, ", parseFloat(intersectionpoint.x), parseFloat(intersectionpoint.y));
    let {avex, avey} = MapMath.GetEndPoint(vertexx, vertexy, aveangle, Math.sqrt( Math.pow(sidedist,2) +  Math.pow(sidedist,2)));

    console.log(" Got these also: vertexx: %s, vertexy: %s, avex: %s, avey: %s", vertexx, vertexy, avex, avey);
    let backangle = MapMath.GetBackAngle(angle1); 
    let {line1x, line1y} = MapMath.GetEndPoint(vertexx, vertexy, backangle , sidedist);
    let {line2x, lineby} = MapMath.GetEndPoint(vertexx, vertexy, angle2, sidedist);

    console.log(" Got these also: banckangle: %s, line1x: %s, line1y: %s, line2x: %s, lineby: %s", backangle, line1x, line1y, line2x, lineby);
    let paths = [];
    paths.push(CreatePathElement(line1x, line1y, avex, avey));
    paths.push(CreatePathElement(line2x, lineby, avex, avey));
    return paths;
}

function DetectAndDrawRightAngles (LayerState, currstepindex, circlesize) {
    let paths = [];

    let sidedist = circlesize + (LayerState.linewidth * 2);
    currstepindex = parseInt(currstepindex);
    let anglea = 0;  
    if (currstepindex == 0) { 
        let laststep = LayerState.steps.length - 1;
        anglea = LayerState.steps[laststep].lineangle;
    } else {
        anglea = LayerState.steps[currstepindex-1].lineangle;
    }
    let angleb = LayerState.steps[currstepindex].lineangle;
   
    if (MapMath.AreRightAngles(anglea, angleb)) {
        let intersectionpoint = LayerState.steps[currstepindex].points[0];
        paths = DrawRightAngleSign(anglea, angleb, intersectionpoint, sidedist);
    }
    return paths;
}

function compileRules(LayerState) {
    let AllRules = [];
    if (LayerState.steps.length && LayerState.rules.length) {
        // setting scale to 0 tells function not to set scale at all 
        //AllRules = CreateGroupElement("rules", 0, 0, 0, 0, 0, LayerState.backcolor, LayerState.forecolor, LayerState.linewidth); 
        for (let i=0; i < LayerState.rules.length; i++) {

            let [stepnum, dist, unit, lengtha, lengthb, da, dx, dy] = LayerState.rules[i];
            stepnum = parseInt(stepnum);
            let stepindex = stepnum - 1;
            dist= parseFloat(dist);
            // linelength is normalized to feet, so convert if necessary
            dist = (unit == "links") ? MapMath.linkstofeet(dist) : dist;
            
            lengtha = (lengtha) ? parseInt(lengtha) : LayerState.linewidth * 2;
            lengthb = (lengthb) ? parseInt(lengthb) : LayerState.linewidth * 2;

            da = (da) ? parseInt(da) : 90;
            let lineangle = LayerState.steps[stepindex].lineangle; 
            let anglea = lineangle + da;
            let angleb = MapMath.GetBackAngle(anglea);
            
            dx = (dx) ? dx : LayerState.fontsize * 2 * 2;
            dy = (dy) ? dy : LayerState.linewidth * 2 * 2;

            let x = LayerState.steps[stepindex].points[0].x;
            let y = LayerState.steps[stepindex].points[0].y;
            let {x1, y1} = MapMath.GetEndPoint(x, y, lineangle, dist) 

            let {ax2, ay2} = MapMath.GetEndPoint(x1, y1, anglea, lengtha); 
            let {bx2, by2} = MapMath.GetEndPoint(x1, y1, angleb, lengthb); 

        
            let rulewidth = LayerState.linewidth / 2;
            let dashlen = rulewidth * 2;
            let dasharray = dashlen + "," + dashlen; 

            // LINE
            AllRules.push(CreateRulePathElement(x1, y1, ax2, ay2, rulewidth, dasharray));
            AllRules.push(CreateRulePathElement(x1, y1, bx2, by2, rulewidth, dasharray));

            // LINE LABEL 
            let rulelabel = "";
            // get any associated label
            for (j=0; j < LayerState.rulelabels.length; j++) {
                let labelargs = splitwords(LayerState.rulelabels[j]);
                if (labelargs) {
                    let labelstepnum = parseInt(labelargs[0]);
                    let labeldist = parseInt(labelargs[1]);
                    if ((labelstepnum == stepnum) && (labeldist == dist)) {
                        rulelabel = labelargs.slice(2).join(" ");
                        break;
                    }
                }
            }
            AllRules.push(CreateTextElement(rulelabel, x, y, dx, dy, anglea, LayerState.forecolor, LayerState.fontsize)); 
        } 
    }
    return AllRules;
}

function GetPaperSizes(size="letter",orientation="portrait") {
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
    console.log("dims:", dims);
    return dims;
}

function GetPrintScale(bbox, finalwidthinches, finalheightinches, dpi) {

    if (typeof finalwidthinches === "string" && typeof finalheightinches === "string") {
        let dims = GetPaperSizes(finalwidthinches, finalheightinches);
        finalwidthinches = dims.width;
        finalheightinches = dims.height;
    }
    const currentWidthInches = (bbox.maxx - bbox.minx) / dpi;
    const currentHeightInches = (bbox.maxy - bbox.miny) / dpi;

    const widthRatio = finalwidthinches / currentWidthInches;
    const heightRatio = finalheightinches / currentHeightInches;

    // Choose the smaller ratio to ensure the bounding box fits within the desired dimensions
    const scale = Math.min(widthRatio, heightRatio);

    // Check if the resulting bounding box exceeds the desired dimensions
    if (currentWidthInches * scale > finalwidthinches || currentHeightInches * scale > finalheightinches) {
        // Scale down to fit within the desired dimensions
        const scaleToFitWidth = finalwidthinches / currentWidthInches;
        const scaleToFitHeight = finalheightinches / currentHeightInches;
        scale = Math.min(scaleToFitWidth, scaleToFitHeight);
  }

  return rounddown(scale);
}


module.exports = { 
    CreateSVGElement,
    CreateGroupElement,
    CreateSVGBaseGroup,
    GetSVGJSON,
    SaveSVGJSON,
    GetImageDimensions,
    GetPointsFromPath,
    CreateLineElement,
    GenerateSVG,
    GetElementsBoundingBox, 
    ScaleElementsBoundingBox, 
}


