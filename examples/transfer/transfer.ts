#!/usr/bin/env bash

// TODO: insights
// - uniform error handling, no || {echo; return 1}
// - named parameters!
// - no implicit global parameters like response
// - quoting is safe; works with filenames with spaces

import {sh, shh, echo} from "shellsync";
import fs from "fs";
let configuredDownloadClient = "";
let configuredUploadClient = "";
let currentVersion="1.22.0";
let down = false;
let response;

/** This function determines which http get tool the system has installed and returns an error if there isnt one. */
function getConfiguredDownloadClient() {
    if (shh.test`command -v curl`)
        configuredDownloadClient = "curl";
    else if (shh.test`command -v wget`)
        configuredDownloadClient="wget"
    else if (shh.test`command -v fetch`)
        configuredDownloadClient="fetch"
    else
        throw new Error("Downloading with this tool reqires either curl, wget, or fetch to be installed.");
}

/** Allows to call the users configured client without if statements everywhere. */
function httpGet(url) {
    switch (configuredDownloadClient) {
        case "curl": return sh` curl -A curl -s ${url}`;
        case "wget": return sh` wget -qO- ${url}`;
        case "httpie": return sh`http -b GET ${url}`;
        case "fetch": return sh`fetch -q ${url}`;
    }
}

/** This function determines which http get tool the system has installed and returns an error if there isnt one. */
function getConfiguredUploadClient() {
    if (shh.test`command -v curl`)
        configuredUploadClient = "curl";
    else if (shh.test`command -v wget`)
        configuredUploadClient = "wget";
    else
        throw new Error("Uploading with this tool reqires either curl or wget to be installed.");
}

/** Allows to call the users configured client without if statements everywhere. */
function httpDownload(targetPath, path, file)  {
    switch (configuredDownloadClient) {
        case "curl": return sh`curl -A curl --progress -o "${targetPath}/${file}" "https://transfer.sh/${path}/${file}`;
        case "wget": return sh`wget --progress=dot -O "${targetPath}/${file}" "https://transfer.sh/${path}/${file}`;
        case "fetch": return sh`fetch -q -o "${targetPath}/${file}" "https://transfer.sh/${path}/${file}`;
    }
}

function checkInternet() {
    try {
        httpGet("github.com");
    } catch {
        throw new Error("no active internet connection");
    }
}

function singleDownload(targetPath, path, file) {
    if (!fs.statSync(`${targetPath}`).isDirectory) {
        echo`Directory doesn't exist, creating it now...`;
        sh`mkdir -p ${targetPath}`;
    }
    if (fs.statSync(`${targetPath}/${file}`).isFile) {
        process.stdout.write(`File aleady exists at ${targetPath}/${file}, do you want to delete it? [Y/n] `);
        const answer = sh`read -r; echo $REPLY`;
        if (!answer.match(/^[Yy]$/))
            throw new Error("Stopping download");
        sh`rm -f ${targetPath}/${file}`;
    }
    echo`Downloading ${file}`;
    httpDownload(targetPath, path, file);
    console.log("Success!");
}

function httpSingleUpload(sourcePath, filename) {
    switch (configuredUploadClient) {
        case "curl": response=sh`curl -A curl --progress --upload-file ${sourcePath} "https://transfer.sh/${filename}`;
        case "wget": response=sh`wget --progress=dot --method PUT --body-file=${sourcePath} "https://transfer.sh/${filename}`;
    }
    echo`Success!`;
}

function printUploadResponse(tempFileName) {
    const fileID = sh`(echo ${response} | cut -d "/" -f 4)`;
    echo`Transfer Download Command: transfer -d desiredOutputDirectory ${fileID} ${tempFileName}`;
    echo`Transfer File URL: ${response}`;
}

function printOntimeUpload(downlink) {
    echo`Download link: ${downlink}`;
}

function singleUpload(sourcePath) {
    sourcePath = sourcePath.replace(/~/, process.env.HOME);
    if (!fs.statSync(sourcePath).isFile) throw new Error("Invalid file path");
    let filename = sourcePath.replace(/.*\\/, "");
    echo`Uploading ${filename}`;
    httpSingleUpload(sourcePath, filename);
}

function onetimeUpload(sourcePath) {
    response = sh`curl -A curl -s -F "file=@${sourcePath}" http://ki.tc/file/u/`;
    return sh`echo $response | python -c "import sys, json; print json.load(sys.stdin)['file']['download_page']`;
}

function usage() {
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

while getopts "o:d:vh" opt; do
  case "$opt" in
    \?) echo "Invalid option: -$OPTARG" >&2
      exit 1
    ;;
    h)  usage
      exit 0
    ;;
    v)  echo "Version $currentVersion"
      exit 0
    ;;
    ;;
    o)
      onetime="true"
    ;;
    d)
      down="true"
      if [ $# -lt 4 ];then { echo "Error: not enough arguments for downloading a file, see the usage"; return 1;};fi
      if [ $# -gt 4 ];then { echo "Error: to many enough arguments for downloading a file, see the usage"; return 1;};fi
      inputFilePath=$(echo "$*" | sed s/-d//g | sed s/-o//g | cut -d " " -f 2)
      inputID=$(echo "$*" | sed s/-d//g | sed s/-o//g | cut -d " " -f 3)
      inputFileName=$(echo "$*" | sed s/-d//g | sed s/-o//g | cut -d " " -f 4)
    ;;
    :)  echo "Option -$OPTARG requires an argument." >&2
      exit 1
    ;;
  esac
done

if [[ $# == "0" ]]; then
  usage
  exit 0
elif [[ $# == "1" ]];then
  if [[ $1 == "help" ]]; then
    usage
    exit 0
  elif [ -f $1 ];then
    getConfiguredDownloadClient || exit 1
    checkInternet || exit 1
    getConfiguredUploadClient || exit 1
    singleUpload "$1" || exit 1
    printUploadResponse
    exit 0
  else
    echo "Error: invalid filepath"
    exit 1
  fi
else
  if $down && ! $onetime ;then
    getConfiguredDownloadClient || exit 1
    checkInternet || exit 1
    getConfiguredDownloadClient || exit 1
    singleDownload "$inputFilePath" "$inputID" "$inputFileName" || exit 1
    exit 0
  elif ! $down && ! $onetime; then
    getConfiguredDownloadClient || exit 1
    checkInternet || exit 1
    getConfiguredUploadClient || exit 1
    for path in "$@";do
      singleUpload "$path" || exit 1
      printUploadResponse
      echo
    done
    exit 0
  elif ! $down && $onetime; then
    getConfiguredDownloadClient || exit 1
    if [[ $configuredDownloadClient -ne "curl" ]];then
      echo "Error: curl must be installed to use one time file upload"
      exit 1
    fi
    inputFileName=$(echo "$*" | sed s/-o//g | cut -d " " -f 2 )
    let downlink = onetimeUpload "$inputFileName"
    printOntimeUpload(downlink);
  fi
fi