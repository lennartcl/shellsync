#!/usr/bin/env bash

import {sh, shh} from "shellsync";
let configuredDownloadClient = "";
let configuredUploadClient = "";
let currentVersion="1.22.0";
let down = false;

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
    if (shh.test`curl`)
        configuredUploadClient = "curl";
    else if (shh.test`wget`)
        configuredUploadClient = "wget";
    else
        throw new Error("Uploading with this tool reqires either curl or wget to be installed.");
}

/** Allows to call the users configured client without if statements everywhere. */
function httpDownload(tempOutputPath, path, file)  {
    try {
        switch (configuredDownloadClient) {
            case "curl": return sh`curl -A curl --progress -o "${tempOutputPath}/${file}" "https://transfer.sh/${path}/${file}`;
            case "wget": return sh`wget --progress=dot -O "${tempOutputPath}/${file}" "https://transfer.sh/${path}/${file}`;
            case "fetch": return sh`fetch -q -o "${tempOutputPath}/${file}" "https://transfer.sh/${path}/${file}`;
        }
    } catch (e) {
        throw new Error("Failure!");
    }
}

checkInternet()
{
  httpGet github.com > /dev/null 2>&1 || { echo "Error: no active internet connection" >&2; return 1; } # query github with a get request
}

singleDownload()
{
  if [[ ! -d $1 ]];then { echo "Directory doesn't exist, creating it now..."; mkdir -p $1;};fi
  tempOutputPath=$1
  if [ -f "$tempOutputPath/$3" ];then
    echo -n "File aleady exists at $tempOutputPath/$3, do you want to delete it? [Y/n] "
    read -r answer
    if [[ "$answer" == [Yy] ]] ;then
      rm -f $tempOutputPath/$3
    else
      echo "Stopping download"
      return 1
    fi
  fi
  echo "Downloading $3"
  httpDownload "$tempOutputPath" "$2" "$3"
  echo "Success!"
}

httpSingleUpload()
{
  case "$configuredUploadClient" in
    curl) response=$(curl -A curl --progress --upload-file "$1" "https://transfer.sh/$2") || { echo "Failure!"; return 1;};;
    wget) response=$(wget --progress=dot --method PUT --body-file="$1" "https://transfer.sh/$2") || { echo "Failure!"; return 1;} ;;
  esac
  echo  "Success!"
}

printUploadResponse()
{
fileID=$(echo $response | cut -d "/" -f 4)
  cat <<EOF
Transfer Download Command: transfer -d desiredOutputDirectory $fileID $tempFileName
Transfer File URL: $response
EOF
}

printOntimeUpload()
{
  cat <<EOF
  Download link: $downlink
EOF
}

singleUpload()
{
  filePath=$(echo $1 | sed s:"~":$HOME:g)
  if [ ! -f $filePath ];then { echo "Error: invalid file path"; return 1;}; fi
  tempFileName=$(echo $1 | sed "s/.*\///")
  echo "Uploading $tempFileName"
  httpSingleUpload "$filePath" "$tempFileName"
}

onetimeUpload()
{
  response=$(curl -A curl -s -F "file=@$1" http://ki.tc/file/u/)
  downlink=$(echo $response | python -c "import sys, json; print json.load(sys.stdin)['file']['download_page']")
}

usage()
{
  cat <<EOF
Transfer
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
EOF
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
    onetimeUpload "$inputFileName"
    printOntimeUpload
  fi
fi