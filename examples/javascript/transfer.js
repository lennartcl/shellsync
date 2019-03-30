#!/usr/bin/env ts-node
/*----------------------------------------------------------------------------------------------
 *  Original work copyright (c) Alexander Epstein.
 *  Modified work copyright (c) Lennart C. L. Kats.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *----------------------------------------------------------------------------------------------*/

const {sh, echo, test} = require("shellsync");
let configuredDownloadClient = "";
let configuredUploadClient = "";
let currentVersion="1.22.0";

/** This function determines which http get tool the system has installed and returns an error if there isnt one. */
function getConfiguredDownloadClient() {
    if (test`command -v curl`)
        configuredDownloadClient = "curl";
    else if (test`command -v wget`)
        configuredDownloadClient="wget"
    else if (test`command -v fetch`)
        configuredDownloadClient="fetch"
    else
        throw new Error("Downloading with this tool requires either curl, wget, or fetch to be installed.");
}

/** Allows to call the users configured client without if statements everywhere. */
function httpGet(url) {
    switch (configuredDownloadClient) {
        case "curl": return sh`curl -A curl -s ${url}`;
        case "wget": return sh`wget -qO- ${url}`;
        case "httpie": return sh`http -b GET ${url}`;
        case "fetch": return sh`fetch -q ${url}`;
    }
}

/** This function determines which http get tool the system has installed and returns an error if there isnt one. */
function getConfiguredUploadClient() {
    if (test`command -v curl`)
        configuredUploadClient = "curl";
    else if (test`command -v wget`)
        configuredUploadClient = "wget";
    else
        throw new Error("Uploading with this tool reqires either curl or wget to be installed.");
}

/** Allows to call the users configured client without if statements everywhere. */
function httpDownload(targetPath, path, file)  {
    switch (configuredDownloadClient) {
        case "curl": return sh`curl -A curl --progress -o "${targetPath}/${file}" "https://transfer.sh/${path}/${file}"`;
        case "wget": return sh`wget --progress=dot -O "${targetPath}/${file}" "https://transfer.sh/${path}/${file}"`;
        case "fetch": return sh`fetch -q -o "${targetPath}/${file}" "https://transfer.sh/${path}/${file}"`;
        default: throw new Error("No configured download client");
    }
}

function checkInternet() {
    try {
        httpGet("github.com");
    } catch (e) {
        throw new Error("no active internet connection");
    }
}

function singleDownload(targetPath, path, file) {
    if (!test`[ -e ${targetPath} ]`) {
        echo`Directory doesn't exist, creating it now...`;
        sh`mkdir -p ${targetPath}`;
    }
    if (test`[ -e ${targetPath}/${file} ]`) {
        echo`File aleady exists at ${targetPath}/${file}, do you want to delete it? [Y/n] `;
        const answer = sh`read -r; echo $REPLY`;
        if (!answer.match(/^[Yy]$/))
            throw new Error("Stopping download");
        sh`rm -f ${targetPath}/${file}`;
    }
    echo`Downloading ${file}`;
    httpDownload(targetPath, path, escape(file));
    echo`Success!`;
}

function httpSingleUpload(sourcePath, filename) {
    let response;
    switch (configuredUploadClient) {
        case "curl": response = sh`curl -A curl --progress --upload-file ${sourcePath} "https://transfer.sh/${filename}"`; break;
        case "wget": response = sh`wget --progress=dot --method PUT --body-file=${sourcePath} "https://transfer.sh/${filename}"`; break;
        default: throw new Error("No upload client defined");
    }
    echo`Success!`;
    return response;
}

function printUploadResponse(filename, response) {
    const fileID = sh`echo ${response} | cut -d "/" -f 4`;
    echo`Transfer Download Command: transfer -d <desiredOutputDirectory> ${fileID} ${filename}`;
    echo`Transfer File URL: ${response}`;
}

function printOnetimeUpload(downlink) {
    echo`Download link: ${downlink}`;
}

function singleUpload(sourcePath) {
    sourcePath = sourcePath.replace(/~/, process.env.HOME);
    if (!test`[ -e ${sourcePath} ]`) throw new Error("Invalid file path" + sourcePath);
    let filename = sourcePath.replace(/.*\\/, "");
    echo`Uploading ${filename}`;
    let response = httpSingleUpload(sourcePath, escape(filename));
    return {filename, response};
}

function onetimeUpload(sourcePath) {
    let response = sh`curl -A curl -s -F "file=@${sourcePath}" http://ki.tc/file/u/`;
    let downlink = sh`echo ${response} | python -c "import sys, json; print json.load(sys.stdin)['file']['download_page']`;
    return {response, downlink};
}

function usage() {
  echo`Transfer
Description: Quickly transfer files from the command line.
Usage: transfer [flags] or transfer [flag] [args] or transfer [filePathToUpload]
  -d       Download a single file
           First arg: Output file directory
           Second arg: File url id
           Third arg: File name
  -o       Onetime file upload
  -h       Show the help
  -v       Get the tool version
  --debug  Show shellsync debug output
Examples:
  transfer.ts ~/fileToTransfer.txt
  transfer.ts ~/firstFileToTransfer.txt ~/secondFileToTransfer.txt ~/thirdFileToTransfer.txt
  transfer.ts -d ~/outputDirectory fileID fileName
  transfer.ts -o ~/fileToTransfer.txt
`;
}

/**
 * Option parsing & command handling: could be done with a npm module like yargs;
 * here we'll stay close to the original and use process.argv.
 */
function main(args) {
    let onetime = false;
    let down = false;
    if (!args[0]) return usage();
    switch (args[0]) {
        case "--debug":
            sh.options.debug = true;
            return main(args.slice(1));
        case "-v":
            echo`Version ${currentVersion}`;
            break;
        case "-o":
            getConfiguredDownloadClient();
            if (configuredDownloadClient !== "curl")
                throw new Error("curl must be installed to use one time file upload");
            let {downlink} = onetimeUpload(args[1]);
            printOnetimeUpload(downlink);
            break;
        case "-d":
            if (args.length < 4) { echo`Error: not enough arguments for downloading a file, see the usage`; process.exit(1); }
            if (args.length > 4) { echo`Error: too many arguments for downloading a file, see the usage`; process.exit(1); }
            getConfiguredDownloadClient();
            singleDownload(args[1], args[2], args[3]);
            break;
        default:
            for (let i = 0; i < args.length; i++) {
                let file = args[i];
                if (!test`[ -e ${file} ]`) {
                    if (/^-/.test(args[i])) usage();
                    else echo`File not found: ${args[i]}`;
                    process.exit(1);
                }
                getConfiguredDownloadClient();
                checkInternet();
                getConfiguredUploadClient();
                let {filename, response} = singleUpload(file);
                printUploadResponse(filename, response);
                continue;
            }
    }
}

const isTesting = typeof it === 'function';
if (!isTesting) main(process.argv.slice(2));

module.exports = {
    getConfiguredDownloadClient,
    getConfiguredUploadClient,
    httpGet,
    httpDownload,
    singleDownload,
    checkInternet,
    singleUpload,
    httpSingleUpload,
    onetimeUpload,
    usage,
    main,
    printUploadResponse,
};