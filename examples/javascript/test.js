/*----------------------------------------------------------------------------------------------
 *  Copyright (c) Lennart C. L. Kats.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *----------------------------------------------------------------------------------------------*/
const {sh} = require("shellsync");
const {getConfiguredDownloadClient, httpDownload, singleDownload, printUploadResponse, singleUpload, getConfiguredUploadClient} = require("./transfer");
const assert = require("assert");

beforeEach(() => {
    sh.mockAllCommands();
    sh.mock("echo *");
    sh.unmock("[ -e *");
});

afterEach(() => sh.unmockAllCommands());

describe('#getConfiguredDownloadClient', () => {
    it('supports curl', () => {
        sh.mock("command -v*", "return 1");
        sh.mock("command -v curl");
        getConfiguredDownloadClient();
    });
    it('supports wget', () => {
        sh.mock("command -v*", "return 1");
        sh.mock("command -v wget");
        getConfiguredDownloadClient();
    });
    it("fails if curl/wget don't exist", (next) => {
        sh.mock("command -v*", "return 1");
        try {
            getConfiguredDownloadClient();
        } catch (e) {
            next();
        }
    });
});

describe('#httpGet', () => {
    it('supports curl', () => {
        sh.mock("command -v*", "return 1");
        sh.mock("command -v curl");
        getConfiguredDownloadClient();
    });
    it('supports wget', () => {
        sh.mock("command -v*", "return 1");
        sh.mock("command -v wget");
        getConfiguredDownloadClient();
    });
    it("fails if curl/wget don't exist", (next) => {
        sh.mock("command -v*", "return 1");
        try {
            getConfiguredDownloadClient();
        } catch (e) {
            next();
        }
    });
});

describe("#httpDownload", () => {
    it("supports curl", () => {
        sh.mock("command -v curl");
        let curl = sh.mock("curl -A curl --progress -o *");
        getConfiguredDownloadClient();
        httpDownload("targetPath", "path", "file");
        assert(curl.called);
    });
});

describe("#singleDownload", () => {
    it("downloads", () => {
        sh.mock("command -v curl");
        sh.mock("mkdir *");
        sh.mock("curl *");
        singleDownload("/tmp/targetPath", "path", "file")
    });
});

describe("#printUploadResponse", () => {
    it("prints upload response", () => {
        sh.unmock("cut *");
        printUploadResponse("hello.txt", "https://transfer.sh/eibhM/hello.txt");
    });
});

describe("#singleUpload", () => {
    it("uploads single files", () => {
        sh.mock("command -v curl");
        sh.mock("curl -A * --upload-file *");
        getConfiguredUploadClient();
        singleUpload(__dirname + "/test.js");
    });
});