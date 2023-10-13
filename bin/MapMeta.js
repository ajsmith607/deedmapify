
const fs = require("fs");
const { parseSync, stringify } = require("svgson");
const yaml = require("js-yaml");
const MapMath = require("./MapMath");
const logall = MapMath.logall;
const rounddown = MapMath.rounddown
const splitwords = MapMath.splitwords;
const FileHelper = require("./FileHelper");
const degstr = MapMath.DEGSTR;
const citestr = MapMath.CITESTR;
 
const dayjs = require("dayjs");
var utc = require('dayjs/plugin/utc')
dayjs.extend(utc)

let dateoptions = {
  year: "numeric", // 4-digit year (e.g., 2022)
  month: "long", // full name of the month (e.g., "January")
  day: "numeric" // day of the month, with no leading zero (e.g., 2)
};

let locale = "en-US"; // English language, United States country

function FormatHTML(fileid, content) {
    return `
<!DOCTYPE html>
<html lang="${locale}" }}">
    <head><link rel="stylesheet" href="./css/default.css";</head>
    <body> 
    <main id="${fileid}" class="main">
        ${content}
    </body>
</html> 
`
}

function FormatMD(fileconfig, FileLayersMap, AllLayersConfigMap, svg, html) {
    let metayaml = {}; 
    metayaml.title =  fileconfig.title || "";
    metayaml.svg = stringify(svg);     

    metayaml.config = [];
    let parentids = [];
    function getAllParents(obj) {
        if (obj.parentid) {
            let parentconfig = AllLayersConfigMap.get(obj.parentid);
            if (parentconfig && ! parentids.includes(parentconfig.id)) {
                parentids.push(parentconfig.id);
                getAllParents(parentconfig);
                metayaml.config.push(parentconfig);
            }
        }
    }

    for (let [layerid, thislayer] of FileLayersMap) {
        let layerconfig = AllLayersConfigMap.get(layerid);
        getAllParents(layerconfig);
        metayaml.config.push(layerconfig);
    }

    metayaml.config.push(fileconfig);
    return `---\n${yaml.dump(metayaml,{"lineWidth": -1})}---\n${html}`;
}

// metacols: num desc course bearing az chainlinks feet
function CompileFileMetadata(fileconfig, FileLayersMap, grids) {  
    let META = "<div class=\"metadata\"> "; 
    META += `<h1 style="color:black">${fileconfig.title}</h1>`;
    if (grids && grids.length > 0) {
        META += "<p>";
        let gridorder = ["major","minor"];
        for (gord=0; gord < gridorder.length; gord++) {
            let nexttype = gridorder[gord];
            for (let g=0; g < grids.length; g++) {
                let gridinstruction = splitwords(grids[g]);
                let type = gridinstruction[0];
                if (nexttype == type) {
                    let size= MapMath.GetFeetOnly(gridinstruction.slice(1).join(" "));
                    META += `${MapMath.titlecase(type)} grid: ${size} feet. `; 
                }
            }
        }
        META += `<span class="scale">drawing scale: ${fileconfig.scale}</scale></p>`;
    }


    for (let [layerid, thislayer] of FileLayersMap) {
        let date = dayjs.utc(thislayer.date).format("MMMM D, YYYY");

        META += ` 
        <div id="${layerid}" style="color:${thislayer.color}">
        <h2>${date || ""} ${thislayer.title || ""}
        <address>${thislayer.loc}<br/>
            (<span property="latitude" content="${thislayer.lat}">${MapMath.formatDMS(thislayer.lat)}</span>,&nbsp;
             <span property="longitude" content="${thislayer.lon}">${MapMath.formatDMS(thislayer.lon)}</span>)
        </address></h2>
        `;
       
        let magdecl = MapMath.rounddown(thislayer.magdecl);

        if (thislayer.area) {
            META += `<p>Total area: ${thislayer.area.toLocaleString()} square feet 
                    (${MapMath.squareFeetToAcres(thislayer.area)} acres).</p>`;
        }

        META += "<p>";
        META += `All bearings true north`;
        if (thislayer.magdecl && thislayer.magdecl != 0) {
            META += `, adjusted for ${magdecl} magnetic declination.`;
        }
        META += "</p>";

        let pointaccum = [];
        META += `<table> <thead> <tr>
                 <th>Step</th> 
                 <th width="60%">Description</th> 
                 <th>Bearing,<br/>adjusted ${magdecl}</th>
                 <th>Distance,<br/>in feet</th></tr></thead>
                 <tbody>`;
        for (let s=0; s < thislayer.steps.length; s++) {
            let step = thislayer.steps[s];
            META += `<tr>
                 <td style="white-space: nowrap">${step.num.toString().toUpperCase()}</td> 
                 <td width="60%">${step.description}</td> 
                 <td style="white-space: nowrap">${MapMath.formatDMS(step.bearing)}<br/>(${step.az} AZ)</td>
                 <td style="white-space: nowrap">${step.feet}</td> 
                 </tr>`;
            if (s==0) { pointaccum.push(thislayer.steps[s].points[0]); }
            if (s < thislayer.steps.length) { pointaccum.push(thislayer.steps[s].points[1] ); }
        }
        META += `</tbody></table>`;
        
        META += `<p><cite>See: ${thislayer.citation}</cite><p>`;
        
        let temppointrows = "";
        for (let p=0; p < pointaccum.length; p++) {
            if (pointaccum[p].description && pointaccum[p].description.length) {
                temppointrows += `<tr><td>${pointaccum[p].label}</td><td>${pointaccum[p].description}</td></tr>`;
            } 
        }
        for (let poi=0; poi < thislayer.points.length; poi++) {
            if (thislayer.points[poi].hide) { continue; }
            let point = thislayer.points[poi];
            if (point.description && point.description.length) {
                temppointrows += `<tr><td>${point.label}</td><td>${point.description}</td></tr>`;
            } 
        }
        if (temppointrows && temppointrows.length) {
            META += `<table> <thead> <tr>
                     <th>Point</th> 
                     <th>Description</th> 
                     <tbody>${temppointrows}</tbody></table>`;
        }
       
        META += "</div>";
    }
    META += "</div>";
    return META;
}



module.exports = { 
    CompileFileMetadata,
    FormatHTML,
    FormatMD,
}
