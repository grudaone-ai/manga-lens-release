import { AbstractClient } from "../../../common/abstract_client";
export class Client extends AbstractClient {
    constructor(clientConfig) {
        super("tmt.tencentcloudapi.com", "2018-03-21", clientConfig);
    }
    async TextTranslate(req, cb) {
        return this.request("TextTranslate", req, cb);
    }
    async ImageTranslateLLM(req, cb) {
        return this.request("ImageTranslateLLM", req, cb);
    }
}
