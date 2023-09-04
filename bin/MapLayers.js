const MapMath = require("./MapMath");
const logall = MapMath.logall;
const rounddown = MapMath.rounddown
const splitwords = MapMath.splitwords;
const FileHelper = require("./FileHelper");
const SVGHelper = require("./SVGHelper");
const Geomagnetism = require("geomagnetism");
const degstr = "°";

function Step(LayerState, Instruction) {
    let ThisStep = { points: [] };
    
    ThisStep.instruction = Instruction;
    let instructionparts = splitwords(Instruction);

    let num = parseInt(instructionparts[0]);
    let stepindex = parseInt(num) - 1;
    ThisStep.num = num;
    ThisStep.labelformat = (LayerState.steplabelformat) ? LayerState.steplabelformat : "<num>";

    let bearing  = instructionparts.slice(1,4).join(" ");
    logall({bearing});
    ThisStep = MapMath.GetAllBearingInfo(bearing, LayerState.magdec, LayerState.rotate, ThisStep);
   
    let distance = instructionparts.slice(4).join(" ");
    ThisStep = MapMath.GetAllDistanceInfo(distance, ThisStep);
    
     console.log("Step %s, distance: %s, feet: %s, linelength: %s, lineangle: %s", num, distance, ThisStep.feet, ThisStep.linelength, ThisStep.lineangle);
    let [x, y] =  [LayerState.currx, LayerState.curry];
    ThisStep.points[0] = { x: x, y: -y }; // curry is prev/orig cart val stored for calcs on this step, so must negate here for consistency 
   
    //console.log("------ Getting endpoint for step: %s, x: %s, y: %s", num, x, y);
    let endpoint = MapMath.GetEndPoint(x, y, ThisStep.lineangle, ThisStep.linelength)
    LayerState.currx = endpoint.x;
    LayerState.curry = endpoint.y;
    ThisStep.points[1] = MapMath.CartCoordstoSVGCoords(endpoint);
   
    //console.log("------ returned: %j", ThisStep);
    // prepopulate mid-point of line
    let midpoint = MapMath.GetEndPoint(x, y, ThisStep.lineangle, ThisStep.linelength/2);
    ThisStep.points[2] = MapMath.CartCoordstoSVGCoords(midpoint); 

    console.log("COMPLETED STEP: %j", ThisStep);
    //LayerState = AccumulatePointData(LayerState, ThisStep.points);
    LayerState.steps[stepindex] = ThisStep;

    return LayerState;
}

function RevStep(LayerState, Instruction) {
    // "Step" then invert bearing, az, point order 
    LayerState = Step(LayerState, Instruction);
    let instructionparts = splitwords(Instruction);
    let num = parseInt(instructionparts[0]);
    let stepindex = num - 1; 
    logall({num}, {stepindex});
    let ThisStep = LayerState.steps[stepindex];

    // invert bearing, az, lineangle
    console.log("revstep bearings: %j", ThisStep);
    let [origbearing, origaz, origlineangle] = [ThisStep.bearing, ThisStep.az, ThisStep.lineangle];
    ThisStep.bearing = ThisStep.backbearing;
    ThisStep.backbearing = origbearing;
    ThisStep.az = ThisStep.backaz;
    ThisStep.backaz = origaz;
    ThisStep.lineangle = ThisStep.backlineangle; 
    ThisStep.lineangle = origlineangle;

    // invert endpoints
    let point1 = LayerState.steps[stepindex].points[0];
    let point2 = LayerState.steps[stepindex].points[1];
    ThisStep.points[0] = point2;
    ThisStep.points[1] = point1;

    LayerState.steps[stepindex] = ThisStep;
    return LayerState;
}

// "connect 4 3 2 5 1 ",
// - connect 6 3 2 1 2 rect-test
function Connect (LayerState, Instruction, AllCompiledLayers) {
    let [thisstepnum, stepnum1, pointnum1, stepnum2, pointnum2, layerid] = splitwords(Instruction);

    let ThisStep = { points: [] };

    let num = parseInt(thisstepnum);
    let stepindex = num - 1; 

    ThisStep.num = num;
    ThisStep.instruction = Instruction;
    ThisStep.labelformat = (LayerState.steplabelformat) ? LayerState.steplabelformat : "<num>";
    
    let x1 = LayerState.steps[parseInt(stepnum1) - 1].points[parseInt(pointnum1) - 1].x;
    let y1 = LayerState.steps[parseInt(stepnum1) - 1].points[parseInt(pointnum1) - 1].y;
    let [x2, y2] = [0,0];

    if (layerid) {
        console.log("  *** Layer ID referenced: %s", layerid);
        let prevlayer = AllCompiledLayers.get(layerid);
        if (prevlayer) {
            let tempx = prevlayer.steps[parseInt(stepnum2) - 1].points[parseInt(pointnum2) - 1].x;
            let tempy = prevlayer.steps[parseInt(stepnum2) - 1].points[parseInt(pointnum2) - 1].y;
            let temprotate = prevlayer.rotate; 
            ({tempx, tempy} = MapMath.MoveAndRotatePoint(tempx, tempy, prevlayer.xoffset, prevlayer.yoffset, prevlayer.rotate));
            x2 = tempx; 
            y2 = tempy; 
        }
    } else {
        x2 = LayerState.steps[parseInt(stepnum2) - 1].points[parseInt(pointnum2) - 1].x;
        y2 = LayerState.steps[parseInt(stepnum2) - 1].points[parseInt(pointnum2) - 1].y;
    }

    ThisStep.points[0] = { x: x1, y: y1};
    ThisStep.points[1] = { x: x2, y: y2};
  
    let dist = MapMath.GetDistanceFromPoints(x1, y1, x2, y2);
    ThisStep = MapMath.GetAllDistanceInfo(dist + " feet", LayerState.rotate, ThisStep);

    let bearing = MapMath.GetBearingsFromPoints(x1, y1, x2, y2);
    ThisStep = MapMath.GetAllBearingInfo(bearing, LayerState.rotate, ThisStep);
   
    // prepopulate mid-point of line
    ThisStep.points[2] = MapMath.GetEndPoint(x1, y1, ThisStep.lineangle, dist/2);
    
    LayerState.steps[stepindex] = ThisStep;
    LayerState.currx = x2;
    LayerState.curry = y2;

    //LayerState = AccumulatePointData(LayerState, ThisStep.points);
    return LayerState;
}

function Reset (LayerState, Instruction, AllCompiledLayers) {
    let [stepnum, pointnum, layerid] = splitwords(Instruction);
    stepnum = parseInt(stepnum); 
    pointnum = parseInt(pointnum);
    if (layerid) {
        console.log("  *** Layer ID referenced: %s", layerid);
        let prevlayer = AllCompiledLayers.get(layerid);
        if (prevlayer) {
            let tempx = prevlayer.steps[stepnum - 1].points[pointnum - 1].x;
            let tempy = prevlayer.steps[stepnum - 1].points[pointnum - 1].y;
            //let temprotate = prevlayer.rotate + prevlayer.magdecl; 
            let temprotate = prevlayer.rotate;
            console.log("  *** Getting layer info, layerid: %s, x: %s, y: %s, rotate: %s", layerid, tempx, tempy, temprotate);
            ({tempx, tempy} = MapMath.MoveAndRotatePoint(tempx, tempy, prevlayer.xoffset, prevlayer.yoffset, prevlayer.rotate));
            console.log("  *** Getting new layer info, layerid: %s, x: %s, y: %s ", layerid, tempx, tempy);
            LayerState.currx = tempx; 
            LayerState.curry = tempy; 
        }
    } else {
        console.log("NO LAYER ID FOR RESET");
        LayerState.currx = LayerState.steps[stepnum - 1].points[pointnum - 1].x;
        LayerState.curry = LayerState.steps[stepnum - 1].points[pointnum - 1].y;
    }
    return LayerState;
}


function Offset (LayerState, Instruction) {
    let [xoffset, yoffset] = splitwords(Instruction);
    console.log("OFFSETTING: xoffset: %s, yoffset: %s", xoffset, yoffset);
    xoffset = parseFloat(xoffset);
    yoffset = parseFloat(yoffset);
    // invert x and y to account for base rotation of -90
    LayerState.currx += yoffset;
    LayerState.curry += xoffset;
    return LayerState;
}

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
        let ruleangle = parseFloat(steplineangle) + angletoline;
        ThisRule = MapMath.GetAllBearingInfo("a " + ruleangle + " z", LayerState.rotate, Thisrule);

        let poslen = rulelength/2; 
        let posang = ruleangle;
        let neglen = rulelength/2;
        let negang = MapMath.GetBackBearing(ruleangle);
        let [rulestartpoint, ruleendpoint] = [null, null];  
        if (ruleangle > 180) {
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

function LabelRule(LayerState, Instruction) {
    let rulelabelparts = splitwords(Instruction);
    let rulenum = rulelabelparts[0];
    let ruleindex = parseInt(rulenum)-1; 
    if (LayerState.rules && LayerState.rules[ruleindex]) {
        LayerState.rules[ruleindex].label = rulelabelparts.slice(1).join(" ");
    }
    return LayerState;
}

function OffsetStepLabel(LayerState, Instruction) {
    let [stepnum, xoffset, yoffset] = splitwords(Instruction);
    yoffset = -yoffset; // y axis is inverted in svg
    let stepindex = (stepnum) ? parseInt(stepnum) - 1 : -1;
    xoffset = parseFloat(xoffset);
    yoffset = parseFloat(yoffset);
    if (stepindex > -1) {
        if (LayerState.steps && LayerState.steps[stepindex]) {
            LayerState.steps[stepindex].dx = xoffset;
            LayerState.steps[stepindex].dy = yoffset;
        }
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

function OffsetPointLabel(LayerState, Instruction) {
    let [stepnum, pointnum, xoffset, yoffset] = splitwords(Instruction); 
    yoffset = -yoffset; // y axis is inverted in svg
    let stepindex  = (stepnum) ? parseInt(stepnum) -1 : -1; 
    let pointindex = (pointnum) ? parseInt(pointnum) -1 : -1; 
    if (stepindex > -1 && pointindex > -1) {
        if (LayerState.steps && LayerState.steps[stepindex]) {
            if (LayerState.steps[stepindex].points && LayerState.steps[stepindex].points[pointindex]) {
                LayerState.steps[stepindex].points[pointindex].dx = xoffset;
                LayerState.steps[stepindex].points[pointindex].dy = yoffset;
            }
        }
    }
    return LayerState;
}

function AddImage(LayerState, Instruction) {
    let img = ({ href: Instruction });
    [img.width, img.height] = SVGHelper.GetImageDimensions(img.href); 
    LayerState.images.push(img);
    return LayerState;
}

function FormatStepLabel(Layerstate, Instruction) {
    let instructionparts = splitwords(Instruction); 
    let stepnum = parseInt(instructionparts[0]);
    let stepindex = stepnum - 1;
    if (LayerState.steps && LayerState.steps[stepindex]) {
        LayerState.steps[stepindex].labelformat = instructionparts.slice(1).join(" ");
    }
    return LayerState;
}

function FormatRuleLabel(Layerstate, Instruction) {
    let instructionparts = splitwords(Instruction); 
    let rulenum = parseInt(instructionparts[0]);
    let ruleindex = rulenum - 1;
    if (LayerState.rules && LayerState.rules[ruleindex]) {
        LayerState.rules[ruleindex].labelformat = instructionparts.slice(1).join(" ");
    }
    return LayerState;
}

function setLineLabel(line) {
    let label = line.labelformat;
    if (label) {
        if (label.includes("<num>")) {                           label = label.replace("<num>", line.num); }
        if (label.includes("<feet>")) {                          label = label.replace("<feet>", line.feet + " feet"); }
        if (label.includes("<ft>")) {                            label = label.replace("<ft>", line.feet + " ft"); }
        if (label.includes("<chains>")) { if (line.chains > 0) { label = label.replace("<chains>", line.chains + " chains"); }} 
        if (label.includes("<ch>")) {     if (line.chains > 0) { label = label.replace("<chains>", line.chains + " ch"); }}
        if (label.includes("<links>")) {  if (line.links > 0) {  label = label.replace("<links>", line.links + " links"); }} 
        if (label.includes("<lk>")) {     if (line.links > 0) {  label = label.replace("<lk>", line.links + " lk"); }} 
        if (label.includes("<az>")) {                            label = label.replace("<az>", line.az + degstr + " az"); }
        if (label.includes("<bearings>")) {
            let [primary, angle, secondary] = splitwords(line.bearing);
            let [deg, min, sec] = angle.split(",");
            deg = (deg) ? deg + degstr : "";
            min = (min) ? min + "'" : "";
            sec = (sec) ? sec + "\"" : "";
            angle = [deg, min, sec].join("");
            let bearings = [primary.toUpperCase(), angle, secondary.toUpperCase()].join(" ");
            label= label.replace("<bearings>", bearings);
        }
        line.label = label;
    }
    return line;
}

function compileLabels(LayerState) {
    let maxpointlabelvalue = 1;
    for (i=0; i < LayerState.steps.length; i++) {
        console.log(" COMPILING labels for layerid: %s, stepnum: %s, labelformat: %s", LayerState.id, i+1, LayerState.steps[i].labelformat);
        // LINE
        LayerState.steps[i] = setLineLabel(LayerState.steps[i]);
        
        // POINTS
        if (LayerState.steps[i].points) {
            // first and last steps' points are labeled differently
            if (i == 0) {
                LayerState.steps[i].points[0].label = MapMath.numberletter(maxpointlabelvalue);
                LayerState.steps[i].points[1].label = "PoB";
            } else if (i == (LayerState.steps.length - 1)) {
                LayerState.steps[i].points[1].label = "";
            } else {
                LayerState.steps[i].points[1].label = MapMath.numberletter(maxpointlabelvalue)
            }
            maxpointlabelvalue++;
        }
    }
    for (r=0; r < LayerState.rules.length; r++) {
        LayerState.rules[r] = setLineLabel(LayerState.rules[r]);
    }
    return LayerState;
}

function ExecuteInstructions(LayerState, AllCompiledLayers) {
    let AllInstructions = LayerState.instructions;
    for (i=0; i < AllInstructions.length; i++) {
        let Instruction = AllInstructions[i];
        console.log("ROUTE: %s ", Instruction);
        let args = splitwords(Instruction);
        let Command = args.shift();
        Instruction = args.join(" ");
        switch (Command) {
            case "step":
                LayerState = Step(LayerState, Instruction);
                break;
            case "revstep":
                LayerState = RevStep(LayerState, Instruction);
                break;
            case "connect":
                LayerState = Connect(LayerState, Instruction, AllCompiledLayers);
                break;
            case "reset":
                LayerState = Reset(LayerState, Instruction, AllCompiledLayers);
                break;
            case "addrule":
                LayerState = AddRule(LayerState, Instruction);
                break;
            case "offset":
                LayerState = Offset(LayerState, Instruction);
                break;
            case "describestep":
                LayerState = DescribeStep(LayerState, Instruction);
                break;
            case "describerule":
                LayerState = DescribeRule(LayerState, Instruction);
                break;
            case "formatsteplabel":
                LayerState = FormatStepLabel(LayerState, Instruction);
                break;
            case "formatrulelabel":
                LayerState = FormatRuleLabel(LayerState, Instruction);
                break;
            case "offsetsteplabel":
                LayerState = OffsetStepLabel(LayerState, Instruction);
                break;
            case "offsetpointlabel":
                LayerState = OffsetPointLabel(LayerState, Instruction);
                break;
            case "addimage":
                LayerState = AddImage(LayerState, Instruction);
                break;
            default:
                console.error(Command + " in (" + Instruction + ") is not a valid instruction."); 
        }
    }
    return LayerState; 
}

function CompileMapLayer (LayerState, AllCompiledMapLayers) {

    // invert incoming rotations, to match SVG angles, which are positive when moving counterclockwise 
    LayerState.magdecl = (LayerState.magdecl) ? MapMath.degstodecs(LayerState.magdecl) : 0;
    LayerState.rotate = (LayerState.rotate) ?  MapMath.degstodecs(LayerState.rotate) : 0;
    // negate the angles for use in calculations to account for directionality differences between Cartesian and SVG coordinates
    LayerState.rotate = MapMath.normalizedegrees(LayerState.rotate + LayerState.magdecl);
    console.log("Mag Dec dec: " + LayerState.magdecl);
    //console.log("AZ ROTATION: %s", LayerState.rotate);
    // LayerState.rotate = MapMath.AzimuthtoSVG(LayerState.rotate);
    // console.log("CART ROTATION: %s", LayerState.rotate);

    LayerState.xoffset = (LayerState.xoffset) ? LayerState.xoffset : "0 feet";
    if (LayerState.xoffset) { LayerState.xoffset = MapMath.GetFeetOnly(splitwords(LayerState.xoffset)); }

    LayerState.yoffset = (LayerState.yoffset) ? LayerState.yoffset : "0 feet";
    if (LayerState.yoffset) { LayerState.yoffset = MapMath.GetFeetOnly(splitwords(LayerState.yoffset)); }

    // compile layer data
    LayerState = ExecuteInstructions(LayerState, AllCompiledMapLayers);
    LayerState = compileLabels(LayerState);
    return LayerState;
}

function Geocode(Surveys) {
    let updated = false;
    if (Surveys) {
        for (i=0; i < Surveys.length; i++) {
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
    backcolor: "transparent",
    forecolor: "black",
    linewidth: 2,
    fontsize: 6,
    displayflags: [],
    
    magdecl: 0,
    instructions: [],

    scale: 1,
    rotate: 0,
    xoffset: "0 feet",
    yoffset: "0 feet",

    // set programmatically 
    minx: 0,
    miny: 0,
    maxx: 0,
    maxy: 0,
    currx: 0,
    curry: 0,
    images: [],
    steps: [],
    rules: [],
    rulelabels: [],
    svg: {},
};


function CompileAllMapLayers (OrderedLayers) {
  
    //let surveysupdated = false;
    //[Surveys, surveysupdated] = Geocode(Surveys);

    // make sure layers are sorted correctly according to parent/child relationships
    let AllCompiledMapLayers = new Map(); 
    for (let i=0; i < OrderedLayers.length; i++) {
        //AllCompiledMapLayers.push(CompileMapLayer(OrderedLayers[i]));
        let CompiledLayer = CompileMapLayer(OrderedLayers[i], AllCompiledMapLayers);
        AllCompiledMapLayers.set(CompiledLayer.id, CompiledLayer);
    }
    return AllCompiledMapLayers;
}


module.exports = { 
    LayerDefaults,
    CompileAllMapLayers,
}
