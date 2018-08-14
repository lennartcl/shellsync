import {sh} from "shellsync";
import {getConfiguredDownloadClient, httpDownload, singleDownload, printUploadResponse, singleUpload, getConfiguredUploadClient} from "./transfer";
import * as assert from "assert";

beforeEach(() => {
    sh.mockAllCommands();
    sh.mock("echo *");
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
        sh.options.debug = true;
        sh.mock("command -v curl");
        getConfiguredUploadClient();
        singleUpload(__dirname + "/test.ts");
    });
});