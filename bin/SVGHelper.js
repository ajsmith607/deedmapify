    
const fs = require("fs");
const path = require("path");
const { parseSync, stringify } = require("svgson");
const sizeOf = require("image-size")
const FileHelper = require("./FileHelper");
const MapMath = require("./MapMath");
const splitwords = MapMath.splitwords;
const logall = MapMath.logall;

function SaveSVGJSON (svg, svgfile, dir) {
    FileHelper.SaveText(stringify(svg), svgfile, dir); 
    return;
}

function GetSVGJSON (svgfile, dir) {
    let svgtext = FileHelper.GetText(svgfile, dir);
    return parseSync(svgtext); 
}

function CreateSVGElement() {
    return { 
        name:    "svg", 
        type:    "element",
        attributes: {
            xmlns:          "http://www.w3.org/2000/svg", 
            "xmlns:xlink":  "http://www.w3.org/1999/xlink"
        },
        children: []
        };
}


// set aside, rotate, offsets for now, because we don't typically know final scale until later,
// at which point, we will update the transform, using these values and scale,
// in the order of operations: scale, rotate, translate
function CreateGroupElement(id, color="black", rotate=0, xoffset=0, yoffset=0, margin=0, linewidth=2, fontsize=6, font="Roboto, sans-serif", fontweight="bold") {
    //let transform = `rotate(${rotate}) translate(${xoffset} ${yoffset})`;
    let g = { 
        rotate: rotate,
        xoffset: xoffset,
        yoffset: yoffset,
        name:    "g", 
        type:    "element",
        attributes: { 
            id:                     id, 
            stroke:                 color,
            fill:                   color,
            "stroke-width":         linewidth,
            "stroke-linecap":       "round",
            "font-family":          font, 
            "font-size":            fontsize , 
            "font-weight":          fontweight, 
        },
        children: [],
    }
    return g;
}

function CreateTextElement (label, x, y, dx=4, dy=4, relangle=0, fontsize=6, textanchor="middle", dombaseline="middle") {
    label = label.toString();
    fontsize = parseFloat(fontsize);
    let charwidth = 0.1 * fontsize;
    let textLength = calculateRotatedTextLength(label, fontsize, parseFloat(relangle), parseFloat(charwidth));
    x = parseFloat(x); y = parseFloat(y); dx = parseFloat(dx); dy = parseFloat(dy);
    return  { 
        name: "text", 
        type: "element", 
        attributes: {
            x: MapMath.rounddown(x + dx),
            y: MapMath.rounddown(y + dy),
            textLength: textLength, 
            transform: "rotate(" + relangle + " " + x + " " + y + ")",
            stroke: "transparent",
            "stroke-width": 0,
            "font-size": fontsize,
            "text-anchor":  textanchor,
            "dominant-baseline": dombaseline,
        },
        children: [{type: "text", value: label.toUpperCase()}],
    }
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
            fill: "transparent",
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

function CreateRulePathElement (x1, y1, x2, y2, linewidth=1, dash="none") {
    let pathelement = CreatePathElement(x1, y1, x2, y2);
    pathelement.attributes["stroke-width"] = linewidth; 
    pathelement.attributes["stroke-dasharray"] = dash; 
    return pathelement;
}

function calculateRotatedTextLength (text, fontsize=6, rotatedegrees = 0, characterWidth = 0.6) {
    const numchars = text.length;
    const rotateradians = MapMath.degstorads(rotatedegrees);  
    const width = Math.abs(Math.cos(rotateradians)) * fontsize * numchars * 0.6;
    return MapMath.rounddown(width);
}


// all images are centered initially on 0,0
function CreateImageElement(image, rotate=0) {
    let style = "";
    if (image.hide) { style = "display:none"; }
    if (image.width == 0 || image.height == 0) {
        [image.width, image.height] = GetImageDimensions(image.href);
    }
    let x = (image.x) ? image.x : image.width / -2;
    let y = (image.y) ? image.y : image.height / -2;
    return { 
        name: "image", 
        type: "element",
        attributes: {
            "xlink:href": image.href, 
            href: image.href, 
            x: x,
            y: y,
            width: image.width,
            height: image.height,
            transform: "rotate(" + rotate + ")",
            style: style
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


function ScaleElementsBoundingBox(LayerState, baserotate=0) {
    // add a default layer margin
    LayerState.minx -= LayerState.margin;
    LayerState.miny -= LayerState.margin;
    LayerState.maxx += LayerState.margin;
    LayerState.maxy += LayerState.margin;

    // rotate
    const rotate = (LayerState.rotate) ? parseFloat(LayerState.rotate) : 0;
    LayerState = MapMath.RotateBoundingBox(LayerState, baserotate + rotate);

    // offset 
    let xoffset = (LayerState.xoffset) ? parseFloat(LayerState.xoffset) : 0;
    let yoffset = (LayerState.yoffset) ? parseFloat(LayerState.yoffset) : 0;

    LayerState.minx += xoffset;
    LayerState.miny += yoffset;
    LayerState.maxx += xoffset;
    LayerState.maxy += yoffset;
    
    LayerState.minx = MapMath.rounddown(LayerState.minx * LayerState.scale);
    LayerState.miny = MapMath.rounddown(LayerState.miny * LayerState.scale);
    LayerState.maxx = MapMath.rounddown(LayerState.maxx * LayerState.scale);
    LayerState.maxy = MapMath.rounddown(LayerState.maxy * LayerState.scale);

    
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

function getEndCircleLabelOffsets(LayerState, thisstep, space) {
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

/*
function collectStepPoints(LayerState) {
    let pointaccum = [];
    for (let s=0; s < LayerState.steps.length; s ++) {
        pointaccum.push(LayerState.steps[s].points[1]);
    }
    return pointaccum;
}
*/ 

function GetCompassGroup(compass) {
    // svg translate uses upper left of polygon as reference point,
    // I want to coerce this to use the center instead
    // size is length of side of square bounding box of polygon
    let x = (compass.x) ? parseFloat(compass.x) : 0;
    let y = (compass.y) ? -parseFloat(compass.y) : 0;

    const color = (compass.color) ? compass.color : "#000000";
    const size = (compass.size) ? parseFloat(compass.size) : 50;
    const rotate = (compass.rotate) ? parseFloat(compass.rotate) : 0;

    const goldenratio = .6;
    const invgoldenratio = .4;

    const half = MapMath.rounddown(size * .5);
    const golden = MapMath.rounddown(size * goldenratio);
    const invgolden = MapMath.rounddown(size * invgoldenratio);

    x = MapMath.rounddown(x - half);
    y = MapMath.rounddown(y - half);
    const Nfontsize = MapMath.rounddown(size * goldenratio * invgoldenratio);
    const Ntexty = MapMath.rounddown(invgolden + (Nfontsize * invgoldenratio)); // font height adjustment

    /*
    let areaText = "" ;
    console.log(compass);
    if (compass.areaSquareFeet > 0) {
        let areax = MapMath.rounddown(x + half) ;
        let lineheight = (1 + goldenratio);
        let areay = MapMath.rounddown(y + half );
        let acres = MapMath.squareFeetToAcres(compass.areaSquareFeet);
        console.log("areax: %s, areay: %s, lineheight: %s", areax, areay, lineheight);
        areaText = `<text x="${areax}" y="${areay}" 
                          font-family="Roboto, sans-serif" font-size="${compass.fontsize}" font-weight="bold" 
                          fill="${color}" stroke-width="0" stroke="transparent"
                          text-anchor="start" dominant-baseline="auto"
                          transform="rotate(${rotate}) translate(${areax})"> 
                    <tspan x="${areax}" dy="${lineheight}em">AREA: </tspan> 
                    <tspan x="${areax}" dy="${lineheight}em">${acres.toLocaleString()} ACRES </tspan> 
                    <tspan x="${areax}" dy="${lineheight}em">(${compass.areaSquareFeet.toLocaleString()} SQ FT)</tspan> 
                    </text>`;
    }
    */

    const compassgroup = `<svg><g id="compass">
                            <polygon points="${half},0 ${size},${size} ${half},${golden} 0,${size}" 
                                     fill="${color}" stroke-width="0" stroke="transparent" 
                                     transform="rotate(${rotate}) translate(${x},${y})"/>
                            <text x="${half}" y="${Ntexty}" 
                                  font-family="Roboto, sans-serif" font-size="${Nfontsize}" font-weight="bold" 
                                  fill="white" stroke-width="0" stroke="transparent"
                                  text-anchor="middle" dominant-baseline="middle" 
                                  transform="rotate(${rotate}) translate(${x},${y})"> N </text>
                        </g></svg>`;
    const compassobject = parseSync(compassgroup);
    return compassobject.children[0];

}

// dx and dy are applied to labels and are relative to the defaults
function GenerateSVG (LayerState) {
    let layergroup = CreateGroupElement(LayerState.id, LayerState.color, 0,
                                    LayerState.xoffset, LayerState.yoffset, 
                                    parseFloat(LayerState.margin),
                                    LayerState.linewidth);
    
                                    //parseFloat(LayerState.margin) * 10,
    // add all images
    if (LayerState.images && LayerState.images.length) {
        for (let i = 0; i < LayerState.images.length; i++) {
            let img = LayerState.images[i];
            //layergroup.children.push(CreateImageElement(img, LayerState.rotate + LayerState.magdecl));
            layergroup.children.push(CreateImageElement(img)); 
        }
    }

    if (LayerState.steps && LayerState.steps.length) {
        const fontsize = parseFloat(LayerState.fontsize);
        const vertfontadj = fontsize / 2;
        const linewidth = parseFloat(LayerState.linewidth);
        const r = linewidth * 2; 
        const circlelabelpadding = r * 2;
        const linelabelpadding = linewidth;

        let labeldx = (LayerState.steps[0].points[0].dx) ? parseFloat(LayerState.steps[0].points[0].dx) : 0;
        let labeldy = (LayerState.steps[0].points[0].dy) ? parseFloat(LayerState.steps[0].points[0].dy) : 0; 
        let [cx, cy] = [LayerState.steps[0].points[0].x, LayerState.steps[0].points[0].y] ;
        let [labelx, labely] = [cx, MapMath.rounddown(cy + (vertfontadj + circlelabelpadding + linewidth))]
        console.log("first circle, labelx: %s, labely: %s", labelx, labely);

        // circle drawing starting point 
        if (! LayerState.displayflags.includes("nosteppoints") && LayerState.steps[0]) {
            layergroup.children.push(CreateCircleElement(cx, cy, r));
            let startlabel = LayerState.steps[0].points[0].label;
            if (LayerState.displayflags.includes("showpointcoords")) { 
                let icy = cy;
                if (icy != 0) { icy = -icy; } // inverted Y axis
                startlabel = startlabel + "(" + cx + "," + icy + ")"; 
            }
            layergroup.children.push(CreateTextElement(startlabel, labelx, labely, labeldx, labeldy, 0,));
        }
       
        // create steps (line and endpoint)
        for (let i = 0; i < LayerState.steps.length; i++) {
console.log(i);
            // LINE
            let [x1, y1] = [ LayerState.steps[i].points[0].x, LayerState.steps[i].points[0].y];
            let [x2, y2] = [ LayerState.steps[i].points[1].x, LayerState.steps[i].points[1].y];
            let [x3, y3] = [ LayerState.steps[i].points[2].x, LayerState.steps[i].points[2].y];
            layergroup.children.push(CreatePathElement(x1, y1, x2, y2));
            
            // LINE LABEL (at 90 degrees of line mid-point)
            let lineangle = parseFloat(LayerState.steps[i].lineangle);
            let textangle = -lineangle; 
            if (lineangle > 90 && lineangle < 270) { textangle = MapMath.GetBackAngle(textangle); }
            let textlength = parseFloat(LayerState.steps[i].linelength);
            let temppoint = MapMath.GetEndPoint(x3, y3, textangle - 90, vertfontadj + linelabelpadding);
            console.log(temppoint);
            labelx = temppoint.x; labely = temppoint.y;
            
            // line label spacing adjustments
            labeldx = (LayerState.steps[i].dx) ? parseFloat(LayerState.steps[i].dx) : 0;
            labeldy = (LayerState.steps[i].dy) ? parseFloat(LayerState.steps[i].dy) : 0;
            //if ((lineangle =< 45 || lineangle > 315) { labeldy += (vertfontadj + linelabelpadding); } 
            //if (lineangle > 45 || lineangle <= 135) { labeldx += r * 2; } 
            //if ((lineangle > 135 || lineangle <= 225) { labeldy -= (vertfontadj + linelabelpadding); } 
            //if ((lineangle > 225 || lineangle <= 315) { labeldx -= linelabelpadding; } 

            if (LayerState.steps[i].label.length < 2) { textangle = 0; } 
            if (! LayerState.displayflags.includes("nosteplabels")) {
                layergroup.children.push(CreateTextElement(LayerState.steps[i].label, labelx, labely, labeldx, labeldy, textangle));
            }
            
            // MIDPOINT
            //layergroup.children.push(CreateCircleElement(x3, y3, r));

            // ENDPOINT CIRCLE AND LABEL
            textangle = 0;
            if (! LayerState.displayflags.includes("nosteppoints")) {
                // is this the endpoint of the first step? If so, increase circle size, and label spacing as this should be the "Place of Beginning"
                let finalr = r; let finalfontsize = fontsize;
                if (i==0) { finalr *= 2; finalfontsize *= 2; }

                let circlelabel = LayerState.steps[i].points[1].label || "";

                let baseoffset = getEndCircleLabelOffsets(LayerState, LayerState.steps[i], finalr + r); 
                if (i==0) { baseoffset.x = 0; }
                labeldx = (LayerState.steps[i].points[1].dx) ? baseoffset.x + parseFloat(LayerState.steps[i].points[1].dx) : baseoffset.x;
                labeldy = (LayerState.steps[i].points[1].dy) ? baseoffset.y + parseFloat(LayerState.steps[i].points[1].dy) : baseoffset.y;

                layergroup.children.push(CreateCircleElement(x2, y2, finalr));
                if (! (circlelabel.toUpperCase() == "POB")) {
                    if (LayerState.displayflags.includes("showpointcoords")) { 
                        let iy2 = y2;
                        if (iy2 != 0) { iy2 = -iy2; } // inverted y axis
                        circlelabel = circlelabel + "(" + x2 + "," + iy2 + ")"; 
                    }
                } 
                layergroup.children.push(CreateTextElement(circlelabel, x2, y2, labeldx, labeldy, textangle, finalfontsize));
                console.log("endcircle label: labelx: %s, labely: %s", labelx, labely);
            }
        }
    }

    //let rules = compileRules(LayerState);
    // if (rules && rules.length > 0) { layergroup.children.push(rules); }
    let points = compilePoints(LayerState);
    if (points && points.length > 0) { layergroup.children.push(points); }

    LayerState.area = MapMath.calculatePolygonArea(LayerState.steps);
    if (LayerState.compass) { 
        // if compass location is not explicitly set, use estimated polygon center
        if (LayerState.compass.x == 0 && LayerState.compass.y == 0) {
            let areaCenterPoint = MapMath.getPolygonCartCenterPoint(LayerState.steps);
            LayerState.compass.x = areaCenterPoint.x;
            LayerState.compass.y = areaCenterPoint.y;
        }
        let compass = GetCompassGroup(LayerState.compass); 
        layergroup.children.push(compass); 
    } 
    LayerState.svg = layergroup; 
    return LayerState;
}

/*
function ConverttoSVG (LayerState) {
    for (let s=0; s < LayerState.steps.length; s++) {
        LayerState.steps[s].lineangle = MapMath.AzimuthtoSVG(LayerState.steps[s].lineangle);
        LayerState.steps[s].blineangle = MapMath.AzimuthtoSVG(LayerState.steps[s].blineangle);
        for (let sp=0; sp < LayerState.steps[s].points.length; sp++) {
            LayerState.steps[s].points[sp] = MapMath.CartCoordstoSVGCoords(LayerState.steps[s].points[sp]);
        }
    }
    for (let r=0; r < LayerState.rules.length; r++) {
        LayerState.rules[r].lineangle = MapMath.AzimuthtoSVG(LayerState.rules[r].lineangle);
        LayerState.rules[r].blineangle = MapMath.AzimuthtoSVG(LayerState.rules[r].blineangle);
        for (let rp=0; rp < LayerState.rules[r].points.length; rp++) {
            LayerState.rules[r].points[rp] = MapMath.CartCoordstoSVGCoords(LayerState.rules[r].points[rp]);
        }
    }
    return LayerState;
}
*/

/*
 * original functions that are not cross-layer aware
 */
function DrawRightAngleSign(angle1, angle2, intersectionpoint, space=8) {
    // put this symbol past the point circle and calculate hypotenuse
    let sidedist = parseFloat(space); 
    let aveangle = MapMath.GetInsideAverageAngle(parseFloat(angle1), parseFloat(angle2));
    [vertexx, vertexy] = [parseFloat(intersectionpoint.x), parseFloat(intersectionpoint.y)];
    let {avex, avey} = MapMath.GetEndPoint(vertexx, vertexy, aveangle, Math.sqrt( Math.pow(sidedist,2) +  Math.pow(sidedist,2)));

    let backangle = MapMath.GetBackAngle(angle1); 
    let {line1x, line1y} = MapMath.GetEndPoint(vertexx, vertexy, backangle , sidedist);
    let {line2x, lineby} = MapMath.GetEndPoint(vertexx, vertexy, angle2, sidedist);

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

/*
 function compileRules(LayerState) {
    let AllRules = [];
    if (LayerState.steps.length && LayerState.rules.length) {
        // setting scale to 0 tells function not to set scale at all 
        for (let i=0; i < LayerState.rules.length; i++) {

    let [rulenum, stepnum, linedist, linedistunit, rulelength, rulelengthunit, lineoffset, angletoline] = splitwords(Instruction);
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
            
            dx = (dx) ? dx : MapMath.rounddown(LayerState.fontsize * 2 * 2);
            dy = (dy) ? dy : MapMath.rounddown(LayerState.linewidth * 2 * 2);

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
            AllRules.push(CreateTextElement(rulelabel, x, y, dx, dy, anglea)); 
        } 
    }
    return AllRules;
}
*/



function compilePoints(LayerState) {
    let pointssvg = [];
    for (p=0; p < LayerState.points.length; p++) {
        if (! LayerState.points[p].hide) {
            let label = LayerState.points[p].label;
            let x = LayerState.points[p].x;
            let y = LayerState.points[p].y;
            let dx = LayerState.points[p].dx;
            let dy = LayerState.points[p].dy;
            let r = LayerState.linewidth * 2;
            console.log("POINT INFO: x: %s, y: %s, r: %s", x, y, r);
            pointssvg.push(CreateCircleElement(x,y,r));     
            if (label) {
                if (LayerState.displayflags.includes("showpointcoords")) { 
                    let iy = y;
                    if (iy != 0) { iy = -iy; } // inverted Y axis
                    label = label + "(" + x + "," + iy + ")"; 
                }
                let textlabel = CreateTextElement(label, x, y, dx, dy, 0);     
                textlabel.attributes["text-anchor"] = "start";
                pointssvg.push(textlabel);
            }
        }
    }
    return pointssvg; 
}




module.exports = { 
    CreateSVGElement,
    CreateGroupElement,
    GetSVGJSON,
    SaveSVGJSON,
    GetImageDimensions,
    GetPointsFromPath,
    CreateLineElement,
    CreateTextElement,
    CreateCircleElement,
    CreatePathElement, 
    CreateRulePathElement,
    GenerateSVG,
    GetElementsBoundingBox, 
    ScaleElementsBoundingBox, 
    GetCompassGroup,
}


