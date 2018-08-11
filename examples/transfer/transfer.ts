#!/usr/bin/env ts-node

// TODO: insights
// - uniform error handling, no || {echo; return 1}
// - named parameters!
// - no implicit global parameters like response
// - quoting is safe; works with filenames with spaces

import {sh, echo} from "shellsync";
import * as fs from "fs";
let configuredDownloadClient = "";
let configuredUploadClient = "";
let currentVersion="1.22.0";
let response;

/** This function determines which http get tool the system has installed and returns an error if there isnt one. */
export function getConfiguredDownloadClient() {
    if (sh.test`command -v curl`)
        configuredDownloadClient = "curl";
    else if (sh.test`command -v wget`)
        configuredDownloadClient="wget"
    else if (sh.test`command -v fetch`)
        configuredDownloadClient="fetch"
    else
        throw new Error("Downloading with this tool requires either curl, wget, or fetch to be installed.");
}

/** Allows to call the users configured client without if statements everywhere. */
export function httpGet(url) {
    switch (configuredDownloadClient) {
        case "curl": return sh`curl -A curl -s ${url}`;
        case "wget": return sh`wget -qO- ${url}`;
        case "httpie": return sh`http -b GET ${url}`;
        case "fetch": return sh`fetch -q ${url}`;
    }
}

/** This function determines which http get tool the system has installed and returns an error if there isnt one. */
export function getConfiguredUploadClient() {
    if (sh.test`command -v curl`)
        configuredUploadClient = "curl";
    else if (sh.test`command -v wget`)
        configuredUploadClient = "wget";
    else
        throw new Error("Uploading with this tool reqires either curl or wget to be installed.");
}

/** Allows to call the users configured client without if statements everywhere. */
export function httpDownload(targetPath, path, file)  {
    switch (configuredDownloadClient) {
        case "curl": return sh`curl -A curl --progress -o "${targetPath}/${file}" "https://transfer.sh/${path}/${file}"`;
        case "wget": return sh`wget --progress=dot -O "${targetPath}/${file}" "https://transfer.sh/${path}/${file}"`;
        case "fetch": return sh`fetch -q -o "${targetPath}/${file}" "https://transfer.sh/${path}/${file}"`;
    }
}

export function checkInternet() {
    try {
        httpGet("github.com");
    } catch {
        throw new Error("no active internet connection");
    }
}

export function singleDownload(targetPath, path, file) {
    if (!fs.statSync(`${targetPath}`).isDirectory) {
        echo`Directory doesn't exist, creating it now...`;
        sh`mkdir -p ${targetPath}`;
    }
    if (fs.statSync(`${targetPath}/${file}`).isFile) {
        echo`File aleady exists at ${targetPath}/${file}, do you want to delete it? [Y/n] `;
        const answer = sh`read -r; echo $REPLY`;
        if (!answer.match(/^[Yy]$/))
            throw new Error("Stopping download");
        sh`rm -f ${targetPath}/${file}`;
    }
    echo`Downloading ${file}`;
    httpDownload(targetPath, path, file);
    console.log("Success!");
}

export function httpSingleUpload(sourcePath, filename) {
    switch (configuredUploadClient) {
        case "curl": response = sh`curl -A curl --progress --upload-file ${sourcePath} "https://transfer.sh/${filename}`;
        case "wget": response = sh`wget --progress=dot --method PUT --body-file=${sourcePath} "https://transfer.sh/${filename}`;
    }
    echo`Success!`;
}

export function printUploadResponse(filename) {
    const fileID = sh`(echo ${response} | cut -d "/" -f 4)`;
    echo`Transfer Download Command: transfer -d <desiredOutputDirectory> ${fileID} ${filename}`;
    echo`Transfer File URL: ${response}`;
}

export function printOntimeUpload(downlink) {
    echo`Download link: ${downlink}`;
}

export function singleUpload(sourcePath) {
    sourcePath = sourcePath.replace(/~/, process.env.HOME);
    if (!fs.statSync(sourcePath).isFile) throw new Error("Invalid file path");
    let filename = sourcePath.replace(/.*\\/, "");
    echo`Uploading ${filename}`;
    httpSingleUpload(sourcePath, filename);
    return filename;
}

export function onetimeUpload(sourcePath) {
    response = sh`curl -A curl -s -F "file=@${sourcePath}" http://ki.tc/file/u/`;
    return sh`echo ${response} | python -c "import sys, json; print json.load(sys.stdin)['file']['download_page']`;
}

export function usage() {
  echo`Transfer
Description: Quickly transfer files from the command line.
Usage: transfer [flags] or transfer [flag] [args] or transfer [filePathToUpload]
  -d  Download a single file
      First arg: Output file directory
      Second arg: File url id
      Third arg: File name
  -o  Onetime file upload
  -h  Show the help
  -v  Get the tool version
Examples:
  transfer ~/fileToTransfer.txt
  transfer ~/firstFileToTransfer.txt ~/secondFileToTransfer.txt ~/thirdFileToTransfer.txt
  transfer -d ~/outputDirectory fileID fileName
  transfer -o ~/fileToTransfer.txt
`;
}

export function main(args) {
    let onetime = false;
    let down = false;
    let arg = args[0];
    if (!arg) usage();
    switch (arg) {
        case "-v":
            echo`Version ${currentVersion}`;
            break;
        case "-o":
            getConfiguredDownloadClient();
            if (configuredDownloadClient !== "curl")
                throw new Error("curl must be installed to use one time file upload");
            let downlink = onetimeUpload(process.argv[2]);
            printOntimeUpload(downlink);
            break;
        case "-d":
            if (process.argv.length < 5) { echo`Error: not enough arguments for downloading a file, see the usage`; process.exit(1); }
            if (process.argv.length > 5) { echo`Error: too many enough arguments for downloading a file, see the usage`; process.exit(1); }
            singleDownload(process.argv[2], process.argv[3], process.argv[4]);
            break;
        default:
            for (let i = 1; i < process.argv.length; i++) {
                let file = process.argv[i];
                if (!fs.statSync(file).isFile) {
                    if (/^-/.test(arg)) usage();
                    else echo`File not found: ${arg}`;
                    process.exit(1);
                }
                getConfiguredDownloadClient();
                checkInternet();
                getConfiguredUploadClient();
                let filename = singleUpload(file);
                printUploadResponse(filename);
                continue;
            }
    }
}

const isTesting = typeof (global as any).it === 'function';
if (!isTesting) main(process.argv);