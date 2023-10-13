const path = require("path");
const fs = require("fs");

function CopyFile(sourceFilePath, destinationFilePath) {
    fs.copyFile(sourceFilePath, destinationFilePath, (err) => {
        if (err) {
            console.error('Error copying file:', err);
        } else {
            console.log('Image file copied successfully!');
        }
    });
}

function PrepareWriteDir (dir) {
    if (! fs.existsSync(dir)) { fs.mkdirSync(dir); }
    return;
}

function GetFiles(dir, excludedirs=true) {
    let finalfiles = [];
    let files = fs.readdirSync(dir);

    try { 
        for (f=0; f < files.length; f++) {
            let filepath = path.join(dir, files[f]);
            if (! (excludedirs && fs.lstatSync(filepath).isDirectory())) {
                finalfiles.push(filepath);
            }
        }
    } catch (error) { console.log(error) }

    return finalfiles;
}

function DeleteFile(filepath) {
    fs.unlink(filepath, (err) => {
        if (err) {
          console.error('Error deleting file:', err);
        } else {
          console.log('Deleted file:', file);
        }
    });
}

function GetText (file, dir="./") {
   let filepath = path.join(dir, file);
   if (fs.existsSync(filepath)) {
        return fs.readFileSync(filepath, "utf8");
    } else {
        console.error("Cannot find file: " + filepath);
    }
}

function GetJSON (file, dir="./") {
    return JSON.parse(GetText(file));
}

function SaveText (text, file, dir="./") {
    PrepareWriteDir(dir);
    let filepath = path.join(dir, file);
    fs.writeFileSync(filepath, text); 
    return;
}

function SaveJSON (json, file, dir="./") {
    return SaveText(JSON.stringify(json), file, dir);
}


module.exports = { 
    PrepareWriteDir, 
    CopyFile, GetFiles, DeleteFile,
    GetText, GetJSON,
    SaveText, SaveJSON,
}
