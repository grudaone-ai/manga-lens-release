import { AbstractClient } from "../../../common/abstract_client";
import { ClientConfig } from "../../../common/interface";
import { ImageTranslateLLMRequest, ImageTranslateLLMResponse, TextTranslateRequest, TextTranslateResponse } from "./tmt_models";
/**
 * tmt client
 * @class
 */
export declare class Client extends AbstractClient {
    constructor(clientConfig: ClientConfig);
    /**
     * 腾讯翻译为合作伙伴提供文本翻译、文档翻译、交互翻译、AI同传等多种机器翻译服务，具有toB多行业解决方案。作为WMT世界机器翻译大赛冠军，翻译准确度值得信赖，其中，交互翻译能力是业界领先技术；腾讯同传是AI同传业界标杆。<br />
提示：对于一般开发者，我们建议优先使用SDK接入简化开发。SDK使用介绍请直接查看 5. 开发者资源 部分。
     */
    TextTranslate(req: TextTranslateRequest, cb?: (error: string, rep: TextTranslateResponse) => void): Promise<TextTranslateResponse>;
    /**
     * 提供18种语言的图片翻译服务，可自动识别图片中的文本内容并翻译成目标语言，识别后的文本按行翻译，后续会提供可按段落翻译的版本。

- 输入图片格式：png、jpg、jpeg等常用图片格式，不支持gif动图。
- 输出图片格式：jpg。

提示：对于一般开发者，我们建议优先使用SDK接入简化开发。SDK使用介绍请直接查看 5. 开发者资源 部分。
     */
    ImageTranslateLLM(req: ImageTranslateLLMRequest, cb?: (error: string, rep: ImageTranslateLLMResponse) => void): Promise<ImageTranslateLLMResponse>;
}
