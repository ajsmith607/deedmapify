
const path = require("path");
const MapMath = require("./MapMath");
const logall = MapMath.logall;
const rounddown = MapMath.rounddown
const splitwords = MapMath.splitwords;
const FileHelper = require("./FileHelper");
const SVGHelper = require("./SVGHelper");
const Geomagnetism = require("geomagnetism");
const degstr = "°";

const colors = new Map();
colors.set("<red>", "#FF4136");
colors.set("<green>", "#2ECC40");
colors.set("<yellow>", "#FFDC00");
colors.set("<blue>", "#001F3F");
colors.set("<gray>", "#AAAAAA");

function ReplaceColor(colortext) {
    for (let [key, value] of colors) {
        if (colortext.includes(key)) {
            colortext = colortext.replace(key, colors.get(key));
        }
    }
    return colortext;
}

function createNewLine(num, Instruction) { return { num: parseInt(num), instruction: Instruction, linelength: 0, lineangle: 0, points: [] }; }

function Step(LayerState, Instruction) {
    let instructionparts = splitwords(Instruction);
    let ThisStep = createNewLine(instructionparts[0], Instruction); 
    
    let stepindex = ThisStep.num - 1;
    //ThisStep.labelformat = (LayerState.steplabelformat) ? LayerState.steplabelformat : "<num>";

    let bearing  = instructionparts.slice(1,4).join(" ");
    ThisStep = MapMath.GetAllBearingInfo(bearing, LayerState.magdecl, LayerState.rotate, ThisStep);
   
    let distance = instructionparts.slice(4).join(" ");
    ThisStep = MapMath.GetAllDistanceInfo(distance, ThisStep);
    
    let [x, y] =  [LayerState.currx, LayerState.curry];
    let startpoint = {x: x, y: y};
    ThisStep.points[0] = startpoint;
  
    // for GetEndPoint to be consistent, y value must be inverted before and after the call,
    // angle does not have to be adjusted as SVG uses standard mathematical convention
    ({x, y} = MapMath.SVGCoordstoCartCoords({x:x,y:y})); 

    //let endpoint = MapMath.GetEndPoint(x, y, ThisStep.lineangle, ThisStep.linelength)
    let endpoint = MapMath.GetEndPoint(x, y, ThisStep.lineangle, ThisStep.linelength)

    endpoint = MapMath.CartCoordstoSVGCoords(endpoint);
    LayerState.currx = endpoint.x;
    LayerState.curry = endpoint.y;
    ThisStep.points[1] = endpoint;
   
    // prepopulate mid-point of line
    ThisStep.points[2] = MapMath.GetEndPoint(x, y, ThisStep.lineangle, ThisStep.linelength/2);
    ThisStep.points[2] = MapMath.CartCoordstoSVGCoords(ThisStep.points[2]);

    console.log("COMPLETED STEP: %j", ThisStep);
    LayerState.steps[stepindex] = ThisStep;

    return LayerState;
}

// - revstep 5 n 58,46 w 3 chains 10 links
function StepBack(LayerState, Instruction) {
    // "Step" then invert bearing, az, point order 
    LayerState = Step(LayerState, Instruction);
    let instructionparts = splitwords(Instruction);
    let num = parseInt(instructionparts[0]);
    let stepindex = num - 1; 
    let ThisStep = LayerState.steps[stepindex];

    // invert bearing, az, lineangle
    let [origbearing, origaz, origlineangle] = [ThisStep.bearing, ThisStep.az, ThisStep.lineangle];
    ThisStep.bearing = ThisStep.bbearing;
    ThisStep.backbearing = origbearing;
    ThisStep.az = ThisStep.baz;
    ThisStep.backaz = origaz;
    ThisStep.lineangle = ThisStep.blineangle; 
    ThisStep.blineangle = origlineangle;
    console.log("REVSTEP: origlineangle: %s, inverted: %s", origlineangle, ThisStep.lineangle);

    // invert endpoints
    let point1 = LayerState.steps[stepindex].points[0];
    let point2 = LayerState.steps[stepindex].points[1];
    ThisStep.points[0] = point2;
    ThisStep.points[1] = point1;

    LayerState.steps[stepindex] = ThisStep;
    return LayerState;
}


function compileLineInfo (ThisLine, svgstart, svgendpoint) {
    ThisLine.points[0] = svgstart;
    ThisLine.points[1] = svgendpoint;

    console.log("in compilelineinfo: %j", ThisLine);
    // convert points to Cartesian coordinates for trig calcs
    let cartstartpoint = MapMath.SVGCoordstoCartCoords(svgstart);
    let cartendpoint = MapMath.SVGCoordstoCartCoords(svgendpoint);
    let cartline = {points:[cartstartpoint, cartendpoint]};
    
    // because lineangle below is derived from previously determined SVG coordinates 
    // that already accounted for both magdecl and additional rotation,
    // the linangle already reflects the magdecl adjustment, and so will the az derived from that lineangle
    // so, in the following calculations, set magdecl and rotation = 0 for consistency
    let magdecl = 0; let rotate = 0;
    ThisLine.lineangle = MapMath.GetAngleFromPoints(cartstartpoint.x, cartstartpoint.y, cartendpoint.x, cartendpoint.y);;
    console.log("in compilelineinfo lineangle: %s", ThisLine.lineangle);
    let az = MapMath.SVGtoAzimuth(ThisLine.lineangle);
    console.log("in compilelineinfo az: %s", az);
    ThisLine = MapMath.GetAllBearingInfo("a " + az + " z", magdecl, rotate, ThisLine);
    
    let dist = MapMath.GetDistanceFromPoints(cartstartpoint.x, cartstartpoint.y, cartendpoint.x, cartendpoint.y);
    ThisLine = MapMath.GetAllDistanceInfo(dist + " feet", ThisLine);

    let midpoint = MapMath.GetEndPoint(cartstartpoint.x, cartstartpoint.y, ThisLine.lineangle, dist/2);
    ThisLine.points[2] = MapMath.CartCoordstoSVGCoords(midpoint);
    return ThisLine;
}


// "connect 4 3 2 5 1 ",
// - connect 6 3 2 1 2 rect-test
/*function ConnectSteps (LayerState, Instruction, AllCompiledLayersMap) {
    let [thisstepnum, stepnum1, pointnum1, stepnum2, pointnum2] = splitwords(Instruction);

    let step1index = parseInt(stepnum1) - 1; let point1index = parseInt(pointnum1) - 1; 
    let step2index = parseInt(stepnum2) - 1; let point2index = parseInt(pointnum2) - 1;

    let svgstartpoint = LayerState.steps[step1index].points[point1index];
    let svgendpoint = LayerState?.steps[step2index]?.points[point2index];
    
    thisstepnum = parseInt(thisstepnum);
    let thisstepindex = thisstepnum - 1;
    let ThisStep = createNewLine(thisstepnum, Instruction); 
    ThisStep = compileLineInfo(ThisStep, svgstartpoint, svgendpoint);
    LayerState.steps[thisstepindex] = ThisStep;
    LayerState.currx = svgendpoint.x;
    LayerState.curry = svgendpoint.y;
    return LayerState;
}
*/

function ConnectSteps (LayerState, Instruction, AllCompiledLayersMap) {
    let [thisstepnum, point1id, point2id] = splitwords(Instruction);

    let svgstartpoint = getLayerPointCoords(LayerState, point1id); 
    let svgendpoint = getLayerPointCoords(LayerState, point2id);
    
    thisstepnum = parseInt(thisstepnum);
    let thisstepindex = thisstepnum - 1;
    let ThisStep = createNewLine(thisstepnum, Instruction); 
    ThisStep = compileLineInfo(ThisStep, svgstartpoint, svgendpoint);
    LayerState.steps[thisstepindex] = ThisStep;
    LayerState.currx = svgendpoint.x;
    LayerState.curry = svgendpoint.y;
    return LayerState;
}

function Reset (LayerState, Instruction, AllCompiledLayersMap) {
    let pointid = Instruction;
    let newpoint = getLayerPointCoords(LayerState, pointid);
    LayerState.currx = newpoint.x; 
    LayerState.curry = newpoint.y;
    return LayerState;
}

// - addpoint steptest step 4 100
function AddPoint (LayerState, Instruction) {
    const instparts = splitwords(Instruction);
    let [pointid, pointtype, ref1, ref2] = instparts.slice(0,4);
    ref1 = parseInt(ref1); ref2 = parseInt(ref2);
    
    let point = {id: pointid, pointtype: pointtype, ref1: ref1, ref2: ref2, x: 0, y: 0, label: "", description: ""};
    if (pointtype == "coord" || pointtype == "coords") {
        [point.x, point.y] = [ref1, ref2]; 
        let temppoint = MapMath.CartCoordstoSVGCoords(point);
        point.x = temppoint.x; point.y = temppoint.y;
    } else if (pointtype == "step") {
        let step = LayerState.steps[ref1 - 1];
        console.log("step: %j", step);
        let distandunits = instparts.slice(3).join(" ");
        let templine = {};
        templine = MapMath.GetAllDistanceInfo(distandunits, templine);

        console.log("step.points[0]: %j", step.points[0]);
        let anchorpoint= MapMath.SVGCoordstoCartCoords(step.points[0]);
        console.log("anchorpoint.x: %s, anchorpoint.y: %s", anchorpoint.x, anchorpoint.y);

        let startpoint = MapMath.GetEndPoint(anchorpoint.x, anchorpoint.y, step.lineangle, templine.linelength);
        console.log("startpoint.x: %s, startpoint.y: %s", startpoint.x, startpoint.y);

        let endpoint = MapMath.CartCoordstoSVGCoords(startpoint);
        console.log("endpoint.x: %s, endpoint.y: %s", endpoint.x, endpoint.y);
        point.x = endpoint.x; point.y = endpoint.y;
        console.log("point.x: %s, point.y: %s", point.x, point.y);

        if (step.num == 4) { 
            console.log("step 4: %j", step);  
            //process.exit(); 
        }
    } else {
        // assume that the pointtype is an image reference and that x and y coordinates are given
        // that are relative to origin at top left of image, but in our maps, images are centered on 0,0
        // so, ajust the x and y accordingly
        //- addpoint schliederb ./images/schlieder.png 2040 3040 
        //- addpoint schliederc ./images/schlieder.png 2406 645  
        for (let i=0; i < LayerState.images.length; i++) {
            if (LayerState.images[i].id == pointtype) {
                let width = LayerState.images[i].width;
                let height = LayerState.images[i].height;
                console.log("image width: %s, image height: %s", width, height);
                // point is relative to origin at 0,0, where image is centered by default
                // coordinates are already SVG compatible, no need to invert 
                [point.x, point.y] = [ref1 - width/2, ref2 - height/2]; 
                break;
            }
        }
    }

    LayerState.points.push(point);
    return LayerState;
}

function LabelPoint (LayerState, Instruction) {
    let instparts = splitwords(Instruction);
    let pointid = instparts[0];
    let label = instparts.slice(1).join(" ");
    if (pointid.includes(",")) {
        let [stepnum, pointnum] = splitwords(pointid, ",");
        LayerState.steps[parseInt(stepnum) - 1].points[parseInt(pointnum) - 1].label = label;
    } else {
        for (let i=0; i < LayerState.points.length; i++) {
            if (LayerState.points[i].id == pointid) {
                LayerState.points[i].label = label;
                break;
            }
        }
        console.log("didn't find pointid: %s", pointid);
        console.log("points: %j", LayerState.points);
    }
    return LayerState; 
}

function MovePointLabel(LayerState, Instruction) {
    let [pointid, xoffset, yoffset] = splitwords(Instruction);
    xoffset = parseFloat(xoffset); yoffset = parseFloat(yoffset);
    yoffset = -yoffset; // y axis is inverted in svg
    if (pointid.includes(",")) {
        let [stepnum, pointnum] = splitwords(pointid, ",");
        let stepindex = parseInt(stepnum) -1; let pointindex = parseInt(pointnum) -1;
        LayerState.steps[stepindex].points[pointindex].dx = xoffset;
        LayerState.steps[stepindex].points[pointindex].dy = yoffset;
    } else {
        for (let i=0; i < LayerState.points.length; i++) {
            if (LayerState.points[i].id == pointid) {
                LayerState.points[i].dx = xoffset;
                LayerState.points[i].dy = yoffset;
                break;
            }
        }
    }
    return LayerState;
}

function DescribePoint (LayerState, Instruction) {
    const instparts = splitwords(Instruction);
    let pointid = instparts[0];
    let description = instparts.slice(1).join(" "); 
    if (pointid.includes(",")) {
        let [stepnum, pointnum] = splitwords(pointid, ",");
        LayerState.steps[parseInt(stepnum) - 1].points[parseInt(pointnum) - 1].description = description;
    } else {
        for (let p=0; p < LayerState.points.length; p++) {
            if (LayerState.points[p].id == pointid) {
                LayerState.points[p].description = description;
                break;
            }
        }
    }
    return LayerState;
}
/*
function Offset (LayerState, Instruction) {
    let [xoffset, yoffset] = splitwords(Instruction);
    console.log("OFFSETTING: xoffset: %s, yoffset: %s", xoffset, yoffset);
    LayerState.xoffset = parseFloat(xoffset);
    LayerState.yoffset = -parseFloat(yoffset);
    //LayerState.currx += xoffset;
    // LayerState.curry += yoffset;
    return LayerState;
}
*/

function AddRuleToPoint(LayerState, Instruction) {
    let [rulenum, pointid, rulelength, rulelengthunit, ruleaz] = splitwords(Instruction);
    rulenum = parseInt(rulenum);
    ruleaz = (ruleaz) ? parseFloat(ruleaz) : 0;
    let ThisRule = createNewLine(rulenum, Instruction);
    ThisRule = MapMath.GetAllDistanceInfo(rulelength + " " + rulelengthunit, ThisRule);

    let svgstartpoint = {};
    if (pointid.includes(",")) {
        let [stepnum, pointnum] = splitwords(pointid, ",");
        svgstartpoint = LayerState.steps[parseInt(stepnum) - 1].points[parseInt(pointnum) - 1];
    } else {
        for (let p=0; p < LayerState.points.length; p++) {
            if (LayerState.points[p].id == pointid) {
                svgstartpoint = LayerState.points[p];
                break;
            }
        }
    }

    let cartendpoint = {};
    if (svgstartpoint) {
        let cartstartpoint = MapMath.SVGCoordstoCartCoords(svgstartpoint);
        let rulelineangle = MapMath.AzimuthtoSVG(ruleaz);
        cartendpoint = MapMath.GetEndPoint(cartstartpoint.x, cartstartpoint.y, rulelineangle, ThisRule.linelength);
        if (cartendpoint) {
            let svgendpoint = MapMath.CartCoordstoSVGCoords(cartendpoint);
            ThisRule = compileLineInfo(ThisRule, svgstartpoint, svgendpoint);
        }
    }
    let ruleindex = rulenum - 1;
    LayerState.rules[ruleindex] = ThisRule;
    return LayerState;
}

function AddRuleToStep(LayerState, Instruction) {
    let [rulenum, stepnum, linedist, linedistunit, rulelength, rulelengthunit, relruleangle] = splitwords(Instruction);
    rulenum = parseInt(rulenum);
    stepnum = parseInt(stepnum);

    let ThisRule = createNewLine(rulenum, Instruction);
    ThisRule = MapMath.GetAllDistanceInfo(rulelength + " " + rulelengthunit, ThisRule);
    
    let stepindex = stepnum - 1;
    if (LayerState.steps && LayerState.steps[stepindex]) {
        let ThisStep = LayerState.steps[stepindex];
        relruleangle = (relruleangle) ? parseFloat(relruleangle) : 90;
        ThisRule.lineangle = parseFloat(ThisStep.lineangle) - parseFloat(relruleangle);
         
        console.log("ThisStep: %j", ThisStep);
        console.log("ThisStep lineangle: %s, ThisRule lineangle: %s", ThisStep.lineangle, ThisRule.lineangle);
        
        let templine = {};
        templine = MapMath.GetAllDistanceInfo(linedist + " " + linedistunit, templine);

        let cartanchorpoint = MapMath.SVGCoordstoCartCoords(ThisStep.points[0]);
        cartrulestartpoint = MapMath.GetEndPoint(cartanchorpoint.x, cartanchorpoint.y, ThisStep.lineangle, templine.linelength); 
        cartruleendpoint = MapMath.GetEndPoint(cartrulestartpoint.x, cartrulestartpoint.y, ThisRule.lineangle, ThisRule.linelength);

        ThisRule = compileLineInfo(ThisRule, MapMath.CartCoordstoSVGCoords(cartrulestartpoint), MapMath.CartCoordstoSVGCoords(cartruleendpoint));
        console.log("ThisStep lineangle: %s, ThisRule lineangle: %s", ThisStep.lineangle, ThisRule.lineangle);
        console.log("added rule: %s", ThisRule);
        // process.exit();
        
    }
    console.log("added rule: %s", ThisRule);
    //process.exit();
    let ruleindex = rulenum - 1;
    LayerState.rules[ruleindex] = ThisRule;
    return LayerState;
}


/*
 *
// the structure of rules mirrors that of steps
function AddRule(LayerState, Instruction) {
    let ThisRule = {};
    ThisRule.instruction = Instruction;
    let [rulenum, stepnum, linedist, linedistunit, rulelength, rulelengthunit, lineoffset, angletoline] = LayerState.rules.push(splitwords(Instruction));

    stepnum = parseInt(stepnum);
    let stepindex = stepnum - 1;
    if (LayerState.steps && LayerState.steps[stepindex]) {
        ThisRule = MapMath.GetAllDistanceInfo(linedist + " " + linedistunit, LayerState.rotate, ThisRule);
        let [stepstartx, stepstarty] = [LayerState.steps[stepindex].points[0].x, LayerState.steps[stepindex].points[0].y]; 
        let steplineangle = LayerState.steps[stepindex].lineangle;
        let rulelinepoint = MapMath.GetEndPoint(stepstartx, stepstarty, steplineangle, linedist);

        angletoline = (angletoline) ? parseFloat(angletoline) : 90; 
        let relruleangle = parseFloat(steplineangle) + angletoline;
        ThisRule = MapMath.GetAllBearingInfo("a " + relruleangle + " z", LayerState.magdecl, LayerState.rotate, Thisrule);

        let poslen = rulelength/2; 
        let posang = relruleangle;
        let neglen = rulelength/2;
        let negang = MapMath.GetBackBearing(relruleangle);
        let [rulestartpoint, ruleendpoint] = [null, null];  
        if (relruleangle > 180) {
            let tempposangle = posang;
            posang = negang;
            negang = tempposangle;
        }
        if (lineoffset && lineoffset != 0) {
            poslen = rulelength + lineoffset;
            neglen = rulelength - lineoffset;
        } 
        rulestartpoint = MapMath.GetEndPoint(rulelinepoint.x, rulelinepoint.y, posang, poslen); 
        ruleendpoint = MapMath.GetEndPoint(rulelinepoint.x, rulelinepoint.y, negang, neglen); 

        // apply offset
        let direction_x = line2['x2'] - line2['x1']
        let direction_y = line2['y2'] - line2['y1']
        
        ThisRule.points = [rulestartpoint, ruleendpoint, rulemidpoint];
        LayerState.rules.push(ThisRule);
    }
    return LayerState;
}

 *
 */
//function GetAllDistanceInfo (distances, line={}) {
// the structure of rules mirrors that of steps
// - addruletostep 1 1 0 feet 200 feet


/*      let step = LayerState.steps[ref1 - 1];
        let distandunits = instparts.slice(3).join(" ");
        let templine = {};
        templine = MapMath.GetAllDistanceInfo(distandunits, templine);
        let {x, y} = MapMath.GetEndPoint(step.points[0].x, step.points[0].y, step.lineangle, templine.feet);
        point.x = x; point.y = y;
*/


/*
function LabelRule(LayerState, Instruction) {
    let rulelabelpart = splitwords(Instruction);
    let rulenum = rulelabelparts[0];
    let ruleindex = parseInt(rulenum)-1; 
    if (LayerState.rules && LayerState.rules[ruleindex]) {
        LayerState.rules[ruleindex].label = rulelabelparts.slice(1).join(" ");
    }
    return LayerState;
}

*/

/*
def move_line_relative(line1, line2, offset):

    midpoint_x = (line1['x1'] + line1['x2']) / 2
    midpoint_y = (line1['y1'] + line1['y2']) / 2

    new_x1_end = midpoint_x + offset * direction_x
    new_y1_end = midpoint_y + offset * direction_y

    line1['x2'] = new_x1_end
    line1['y2'] = new_y1_end

# Example usage
line1 = {'x1': 50, 'y1': 100, 'x2': 150, 'y2': 100}
line2 = {'x1': 100, 'y1': 50, 'x2': 100, 'y2': 150}
offset = 20

move_line_relative(line1, line2, offset)

print(line1)  # Updated coordinates of line1
 */


function MoveStepLabel(LayerState, Instruction) {
    let [stepnum, xoffset, yoffset] = splitwords(Instruction);
    let stepindex = parseInt(stepnum) - 1;
    xoffset = parseFloat(xoffset);
    yoffset = -parseFloat(yoffset); // y axis is inverted in svg
    if (LayerState.steps && LayerState.steps[stepindex]) {
        LayerState.steps[stepindex].dx = xoffset;
        LayerState.steps[stepindex].dy = yoffset;
    }
    return LayerState;
}

function MoveRuleLabel(LayerState, Instruction) {
    let [rulenum, xoffset, yoffset] = splitwords(Instruction);
    let ruleindex = parseInt(rulenum) - 1;
    xoffset = parseFloat(xoffset);
    yoffset = -parseFloat(yoffset); // y axis is inverted in svg
    if (LayerState.rules && LayerState.rules[ruleindex]) {
        LayerState.rules[ruleindex].dx = xoffset;
        LayerState.rules[ruleindex].dy = yoffset;
    }
    return LayerState;
}

function DescribeStep (LayerState, Instruction) {
    let instructionparts = splitwords(Instruction); 
    let stepnum = parseInt(instructionparts[0]);
    let stepindex = stepnum - 1;
    if (LayerState.steps && LayerState.steps[stepindex]) {
        LayerState.steps[stepindex].description = instructionparts.slice(1).join(" ");
    }
    return LayerState;
}

function DescribeRule(LayerState, Instruction) {
    let instructionparts = splitwords(Instruction); 
    let rulenum = parseInt(instructionparts[0]);
    let ruleindex = rulenum - 1;
    if (LayerState.rules && LayerState.rules[ruleindex]) {
        LayerState.rules[ruleindex].description = instructionparts.slice(1).join(" ");
    }
    return LayerState;
}

/*
// - describesteppoint 1 1 "The center of the mill race bridge at the center of Creek Road."
function DescribeStepAnchor (LayerState, Instruction) {
    const instparts = splitwords(Instruction);
    const stepind= parseInt(instparts[0]) -1;
    const pointind= parseInt(instparts[1]) -1;
    const desc = instparts.slice(2).join(" ");
    if (LayerState.steps[stepind] && LayerState.steps[stepind].points[pointind]) {
        LayerState.steps[stepind].points[pointind].description = desc;
    }
    return LayerState;
}
*/


function AddImage(LayerState, Instruction) {
    // copy source file to a directory under maps that mirrors the source directory structure
    let [filename, hide] = splitwords(Instruction);
    hide = (hide) ? hide : false;
    let relpath = "images";
    let originpath = path.join(relpath, filename);
    console.log("Adding image: %s, hide: %s", originpath, hide);

    let destdir = path.join("maps", relpath);
    FileHelper.PrepareWriteDir (destdir); 
    let destpath = path.join(destdir, filename);
    FileHelper.CopyFile(originpath, destpath);    
     
    let img = ({ id: filename, href: originpath, hide: hide });
    [img.width, img.height] = SVGHelper.GetImageDimensions(img.href); 
    LayerState.images.push(img);
    return LayerState;
}

function LabelStep(LayerState, Instruction) {
    let instructionparts = splitwords(Instruction); 
    let stepnum = parseInt(instructionparts[0]);
    let stepindex = stepnum - 1;
    if (LayerState.steps && LayerState.steps[stepindex]) {
        LayerState.steps[stepindex].labelformat = instructionparts.slice(1).join(" ");
    }
    return LayerState;
}

function LabelRule(LayerState, Instruction) {
    let instructionparts = splitwords(Instruction); 
    let rulenum = parseInt(instructionparts[0]);
    let ruleindex = rulenum - 1;
    if (LayerState.rules && LayerState.rules[ruleindex]) {
        LayerState.rules[ruleindex].labelformat = instructionparts.slice(1).join(" ");
    }
    return LayerState;
}

function setLineLabel(line, defaultformat="<num>") {
    if (! line ) { return line; }
    let label = (line.labelformat) ? line.labelformat : defaultformat;
    console.log("step: %s, steplabelformat: |%s|, default: %s", line.num, line.labelformat, defaultformat);
    if (label) {
        if (label.includes("<blank>")) {                              label = ""; 
        } else {
            // normalize placeholder names
            if (label.includes("<foot>")) {                           label = label.replace("<foot>", "<feet>"); }
            if (label.includes("<chain>")) {                          label = label.replace("<chain>", "<chains>"); }
            if (label.includes("<link>")) {                           label = label.replace("<link>", "<links>"); }
            if (label.includes("<chainlink>")) {                      label = label.replace("<chainlink>", "<chainlinks>"); }
            // if (label.includes("<chainlinks>")) {                     label = label.replace("<chainlinks>", "<chains> <links>"); }
            if (label.includes("<chlk>")) {                           label = label.replace("chlk>", "<chlks>"); }
            if (label.includes("<chs>")) {                            label = label.replace("<chs>", "<ch>"); }
            if (label.includes("<lks>")) {                            label = label.replace("<lks>", "<lk>"); }
            // if (label.includes("<chlk>")) {                           label = label.replace("<chlk>", "<ch> <lk>"); }
            if (label.includes("<bearing>")) {                        label = label.replace("<bearing>", "<bearings>"); }
            if (label.includes("<bbearing>")) {                       label = label.replace("<bbearing>", "<bbearings>"); }

            // now do actual substitutions
            if (label.includes("<num>")) {                            label = label.replace("<num>", line.num); }
            if (label.includes("<feet>")) {
                let unit = (line.feet == 1) ? " foot" : " feet";      label = label.replace("<feet>", line.feet.toLocaleString() + unit); 
            }
            if (label.includes("<ft>")) {                             label = label.replace("<ft>", line.feet + " ft"); }
            if (label.includes("<chains>")) { 
                let unit = (line.chains == 1) ? " chain" : " chains"; label = label.replace("<chains>", line.chains + unit); 
            } 
            if (label.includes("<ch>")) {                             label = label.replace("<ch>", line.chains + " ch"); }
            if (label.includes("<links>")) {  
                let unit = (line.links == 1) ? " link" : " links";    label = label.replace("<links>", line.links + unit); 
            } 
            if (label.includes("<lk>")) {                             label = label.replace("<lk>", line.links + " lk"); } 
            if (label.includes("<az>")) {                             label = label.replace("<az>", line.az + degstr + " az"); }
            if (label.includes("<baz>")) {                            label = label.replace("<baz>", line.baz + degstr + " rev"); }
            if (label.includes("<la>")) {                             label = label.replace("<la>", line.lineangle + " la"); }
            if (label.includes("<bearings>")) {                       label = label.replace("<bearings>", MapMath.formatDMS(line.bearing)); }
            if (label.includes("<bbearings>")) {                      label = label.replace("<bbearings>", MapMath.formatDMS(line.bbearing) + " rev"); }
        }
    }
    line.label = label;
    console.log("finalsteplabel: |%s|", label);
    return line;
}

/*
 *
            let [primary, angle, secondary] = splitwords(line.bearing);
            let [deg, min, sec] = angle.split(",");
            deg = (deg) ? deg + degstr : "";
            min = (min) ? min + "'" : "";
            sec = (sec) ? sec + "\"" : "";
            angle = [deg, min, sec].join("");
            let bearings = [primary.toUpperCase(), angle, secondary.toUpperCase()].join(" ");
 *
 *
 */

function compileLabels(LayerState) {
    let maxpointlabelvalue = 1;
    for (let i=0; i < LayerState.steps.length; i++) {
        if (! LayerState.steps[i]) { continue; }

        // LINE
        LayerState.steps[i] = setLineLabel(LayerState.steps[i], LayerState.steplabelformat);
        
        // POINTS
        if (LayerState.steps[i].points) {
            // first and last steps' points are labeled differently
            if (i == 0) {
                if (! LayerState.steps[i].points[0].label) { LayerState.steps[i].points[0].label = MapMath.numberletter(maxpointlabelvalue); }
                if (! LayerState.steps[i].points[1].label) { LayerState.steps[i].points[1].label = "PoB"; }
            } else if (i == (LayerState.steps.length - 1)) {
                if (! LayerState.steps[i].points[0].label) { LayerState.steps[i].points[1].label = "";}
            } else {
                if (! LayerState.steps[i].points[1].label) { LayerState.steps[i].points[1].label = MapMath.numberletter(maxpointlabelvalue); }
            }
            maxpointlabelvalue++;
        }
    }
    for (let r=0; r < LayerState.rules.length; r++) {
        LayerState.rules[r] = setLineLabel(LayerState.rules[r]);
    }
    return LayerState;
}

function AddCompass(Instruction) {
    let [x, y, size, color, rotate] = splitwords(Instruction); 
    color = (color) ? color : "darkgray";
    color = ReplaceColor(color);
    rotate = (rotate) ? parseFloat(rotate) : 0;
    return compass = {
        x:              parseFloat(x) || 0,
        y:              parseFloat(y) || 0,
        xoffset:        0,
        yoffset:        0, 
        size:           parseFloat(size) || 50,
        color:          ReplaceColor(color) || "darkgray",
        rotate:         parseFloat(rotate) || 0,
    };
}

function getCompiledLayerbyID(layerid, LayerState, AllCompiledLayersMap) {
    if (layerid == "<this>") { return LayerState; }
    return AllCompiledLayersMap.get(layerid);
}

function scalepoint(point, scale) {
    point.x = point.x * scale; 
    point.y = point.y * scale;
    return point;
}

function getLayerPointCoords(layer, pointid, layerid="<this>") {
    let [x,y] = [0,0];
    if (layer) {
        console.log("");
        console.log("GETLAYERPOINTCOORDS");
        console.log("layerid: %s, pointid: %s", layer.id, pointid);
        if (pointid.includes(",")) {
            let [stepnum, pointnum] = splitwords(pointid, ",");
            console.log("got a step/point reference stepnum: %s, pointnum: %s", stepnum, pointnum);
            let stepindex = parseInt(stepnum) -1; let pointindex = parseInt(pointnum) -1;
            console.log("stepindex: %s, pointindex: %s", stepindex, pointindex);
            //console.log("layer: %o", layer);
            x = layer.steps[stepindex].points[pointindex].x 
            y = layer.steps[stepindex].points[pointindex].y;
        } else {
            console.log("got a pointid reference pointid: %s", pointid);
            for (let p=0; p < layer.points.length; p++) {
                if (layer.points[p].id == pointid) {
                    x = layer.points[p].x 
                    y = layer.points[p].y;
                    break;
                }
            }
        }
    }
    console.log("before adjusting x: %s, y: %s", x, y);
    let finalpoint = {x, y};
    if (layerid != "<this>" && layerid != layer.id) {
        finalpoint = MapMath.MoveAndRotatePoint(finalpoint.x, finalpoint.y, layer.xoffset, layer.yoffset, layer.rotate);
        finalpoint = scalepoint(finalpoint, layer.scale); 
    }
    x = finalpoint.x; y = finalpoint.y;

    console.log("final x: %s, y: %s", x, y);
    return {x, y};
}


function ConnectPointsWithRule(LayerState, Instruction, AllCompiledLayersMap) {
    [rulenum, layer1id, point1id, layer2id, point2id] = splitwords(Instruction);

    let ThisRule = createNewLine(rulenum, Instruction);
    let layer1 = getCompiledLayerbyID(layer1id, LayerState, AllCompiledLayersMap); 
    let layer2 = getCompiledLayerbyID(layer2id, LayerState, AllCompiledLayersMap); 
    
    let svgpoint1 = getLayerPointCoords(layer1, point1id, layer1id);
    let svgpoint2 = getLayerPointCoords(layer2, point2id, layer2id);

    ThisRule = compileLineInfo(ThisRule, svgpoint1, svgpoint2);
    let ruleindex = parseInt(rulenum) -1;
    LayerState.rules[ruleindex] = ThisRule;

    console.log("CONNECT RULE: %j", ThisRule);
    return LayerState;
}
 
function ExecuteInstructions(LayerState, AllCompiledLayersMap) {
    let AllInstructions = LayerState.instructions;
    for (let i=0; i < AllInstructions.length; i++) {
        let Instruction = AllInstructions[i];
        console.log("ROUTE: %s ", Instruction);
        let args = splitwords(Instruction);
        let Command = args.shift();
        Instruction = args.join(" ");
        switch (Command) {

            // STEPS
            case "step":
                LayerState = Step(LayerState, Instruction);
                break;
            case "stepback":
                LayerState = StepBack(LayerState, Instruction);
                break;
            case "connectsteps":
                LayerState = ConnectSteps(LayerState, Instruction, AllCompiledLayersMap);
                break;
            case "reset":
                LayerState = Reset(LayerState, Instruction, AllCompiledLayersMap);
                break;
            case "labelstep":
                LayerState = LabelStep(LayerState, Instruction);
                break;
            case "movesteplabel":
                LayerState = MoveStepLabel(LayerState, Instruction);
                break;
            case "describestep":
                LayerState = DescribeStep(LayerState, Instruction);
                break;

            // POINTS
            case "addpoint":
                LayerState = AddPoint(LayerState, Instruction);
                break;
            case "labelpoint":
                LayerState = LabelPoint(LayerState, Instruction);
                break;
            case "movepointlabel":
                LayerState = MovePointLabel(LayerState, Instruction);
                break;
            case "describepoint":
                LayerState = DescribePoint(LayerState, Instruction);
                break;

            // RULES
            case "addruletostep":
                LayerState = AddRuleToStep(LayerState, Instruction);
                break;
            case "addruletopoint":
                LayerState = AddRuleToPoint(LayerState, Instruction);
                break;
            case "connectpointswithrule":
                LayerState = ConnectPointsWithRule(LayerState, Instruction, AllCompiledLayersMap);
                break;
            case "labelrule":
                LayerState = LabelRule(LayerState, Instruction);
                break;
            case "moverulelabel":
                LayerState = MoveRuleLabel(LayerState, Instruction);
                break;
            case "describerule":
                LayerState = DescribeRule(LayerState, Instruction);
                break;
           
            // IMAGES and MISC   
            case "addimage":
                LayerState = AddImage(LayerState, Instruction);
                break;
            case "addcompass":
                LayerState.compass = AddCompass(Instruction);
                break;
            default:
                console.error(Command + " in (" + Instruction + ") is not a valid instruction."); 
        }
    }
    return LayerState; 
}

/*function ConvertLayerToSVG(LayerState) {
    for (let s=0; s < LayerState.steps.length; s++) {
        
        //LayerState.steps[s].lineangle = LayerState.steps[s].az;
        LayerState.steps[s].lineangle = 90 - LayerState.steps[s].az;
        //LayerState.steps[s].lineangle = MapMath.AzimuthtoSVG(LayerState.steps[s].az);
        console.log("from AZ: %s, to lineangle: %s", LayerState.steps[s].az, LayerState.steps[s].lineangle );
        LayerState.steps[s].blineangle = 90 - LayerState.steps[s].az;
        for (let sp=0; sp < LayerState.steps[s].points.length; sp++) {
            console.log("Y BEGINS AS: %s", LayerState.steps[s].points[sp].y);
            //LayerState.steps[s].points[sp].y = -LayerState.steps[s].points[sp].y;
            //LayerState.steps[s].points[sp] =  MapMath.CartCoordstoSVGCoords(LayerState.steps[s].points[sp]);    
            console.log("Y ENDS AS: %s", LayerState.steps[s].points[sp].y);
        }
    }
    return LayerState;
}
*/

function CompileMapLayer (LayerState, AllCompiledLayersMap) {
    // invert incoming rotations, to match SVG angles, which are positive when moving counterclockwise 
    LayerState.magdecl = (LayerState.magdecl) ? MapMath.degstodecs(LayerState.magdecl) : 0;
    LayerState.rotate = (LayerState.rotate) ?  MapMath.degstodecs(LayerState.rotate) : 0;
    // negate the angles for use in calculations to account for directionality differences between Cartesian and SVG coordinates
    LayerState.rotate = MapMath.normalizedegrees(LayerState.rotate);
    console.log("Mag Dec dec: " + LayerState.magdecl);

    LayerState.xoffset = (LayerState.xoffset) ? parseFloat(LayerState.xoffset) : "0";
    // inverted y axis... 
    LayerState.yoffset = (LayerState.yoffset) ? -parseFloat(LayerState.yoffset) : "0";
    console.log("yoffset: %s", LayerState.yoffset);

    LayerState.color = ReplaceColor(LayerState.color);
    // compile layer data
    LayerState = ExecuteInstructions(LayerState, AllCompiledLayersMap);
    //LayerState = ConvertLayerToSVG(LayerState);
    LayerState = compileLabels(LayerState);
    return LayerState;
}




function Geocode(Surveys) {
    let updated = false;
    if (Surveys) {
        for (let i=0; i < Surveys.length; i++) {
            // geocode address
            if (! (Surveys[i].lat && Surveys[i].lon)) {
                if (Surveys[i].address) {
                    // get lat and lon
                }
            }
            // get magnetic declination
            if (! Surveys[i].magdecl) {
                if (Surveys[i].surveydate && Surveys[i].lat && Surveys[i].lon) {
                    // lookup magnetic declination
                    const model = Geomagnetism.model(new Date(Surveys[i].surveydate));
                    const info = model.point([Surveys[i].lat, Surveys[i].lon]);
                    Surveys[i].magdecl = info.decl; 
                    console.log('declination lookup:', info.decl);
                }
            }
        }
    }
    return [Surveys, updated];
}

let LayerDefaults = {
    // configurable
    id: "",
    parentid: "",
    color: "black",
    linewidth: 2,
    fontsize: 6,
    displayflags: [],
   
    title: "",
    description: "",
    citations: [], 
    notes: [],

    date: "", // YYYY-MM-DD
    lat: "",
    lon: "",
    magdecl: 0,

    instructions: [],
    steplabelformat: "<num>",

    scale: 1, // 0 signfies that scale will inherit from parent group, unless specifcally set elsewhere
    rotate: 0, // in degrees
    margin: 12, // in feet at scale 1
    xoffset: 0, // in feet at scale 1
    yoffset: 0, // in feet at scale 1

    // set programmatically 
    minx: Number.MAX_VALUE,
    miny: Number.MAX_VALUE,
    maxx: Number.MIN_VALUE,
    maxy: Number.MIN_VALUE,

    currx: 0,
    curry: 0,
    area: 0,
    images: [],
    steps: [],
    points: [],
    rules: [],
    svg: {},
};


function CompileAllMapLayers (OrderedLayers) {
  
    //let surveysupdated = false;
    //[Surveys, surveysupdated] = Geocode(Surveys);

    // make sure layers are sorted correctly according to parent/child relationships
    let AllCompiledLayersMap = new Map(); 
    for (let i=0; i < OrderedLayers.length; i++) {
        let LayerState = {};
        LayerState = CompileMapLayer(OrderedLayers[i], AllCompiledLayersMap);
        AllCompiledLayersMap.set(LayerState.id, LayerState);
    }
    return AllCompiledLayersMap;
}


module.exports = { 
    LayerDefaults,
    CompileAllMapLayers,
    ReplaceColor, 
    getLayerPointCoords,
    AddCompass,
}
