import { AbstractClient } from "../../../common/abstract_client";
export class Client extends AbstractClient {
    constructor(clientConfig) {
        super("vclm.tencentcloudapi.com", "2024-05-23", clientConfig);
    }
    async SubmitHunyuanToVideoJob(req, cb) {
        return this.request("SubmitHunyuanToVideoJob", req, cb);
    }
    async DescribeVideoEditJob(req, cb) {
        return this.request("DescribeVideoEditJob", req, cb);
    }
    async SubmitPortraitSingJob(req, cb) {
        return this.request("SubmitPortraitSingJob", req, cb);
    }
    async DescribeVideoEditKlingJob(req, cb) {
        return this.request("DescribeVideoEditKlingJob", req, cb);
    }
    async DescribeTextToVideoJob(req, cb) {
        return this.request("DescribeTextToVideoJob", req, cb);
    }
    async SubmitTextToVideoViduJob(req, cb) {
        return this.request("SubmitTextToVideoViduJob", req, cb);
    }
    async SubmitMotionControlKlingJob(req, cb) {
        return this.request("SubmitMotionControlKlingJob", req, cb);
    }
    async SubmitVideoFaceFusionJob(req, cb) {
        return this.request("SubmitVideoFaceFusionJob", req, cb);
    }
    async DescribeReferenceToVideoViduJob(req, cb) {
        return this.request("DescribeReferenceToVideoViduJob", req, cb);
    }
    async SubmitImageToVideoViduJob(req, cb) {
        return this.request("SubmitImageToVideoViduJob", req, cb);
    }
    async CheckAnimateImageJob(req, cb) {
        return this.request("CheckAnimateImageJob", req, cb);
    }
    async SubmitVideoExtendKlingJob(req, cb) {
        return this.request("SubmitVideoExtendKlingJob", req, cb);
    }
    async DescribeImageToVideoGeneralJob(req, cb) {
        return this.request("DescribeImageToVideoGeneralJob", req, cb);
    }
    async DescribeTemplateToVideoJob(req, cb) {
        return this.request("DescribeTemplateToVideoJob", req, cb);
    }
    async SubmitVideoStylizationJob(req, cb) {
        return this.request("SubmitVideoStylizationJob", req, cb);
    }
    async DescribePortraitSingJob(req, cb) {
        return this.request("DescribePortraitSingJob", req, cb);
    }
    async DescribeMotionControlKlingJob(req, cb) {
        return this.request("DescribeMotionControlKlingJob", req, cb);
    }
    async DescribeVideoExtendKlingJob(req, cb) {
        return this.request("DescribeVideoExtendKlingJob", req, cb);
    }
    async SubmitTemplateToVideoJob(req, cb) {
        return this.request("SubmitTemplateToVideoJob", req, cb);
    }
    async SubmitVideoEditJob(req, cb) {
        return this.request("SubmitVideoEditJob", req, cb);
    }
    async DescribeVideoVoiceJob(req, cb) {
        return this.request("DescribeVideoVoiceJob", req, cb);
    }
    async SubmitImageToVideoJob(req, cb) {
        return this.request("SubmitImageToVideoJob", req, cb);
    }
    async DescribeHumanActorJob(req, cb) {
        return this.request("DescribeHumanActorJob", req, cb);
    }
    async SubmitAigcVideoJob(req, cb) {
        return this.request("SubmitAigcVideoJob", req, cb);
    }
    async SubmitVideoVoiceJob(req, cb) {
        return this.request("SubmitVideoVoiceJob", req, cb);
    }
    async SubmitHumanActorJob(req, cb) {
        return this.request("SubmitHumanActorJob", req, cb);
    }
    async DeleteAigcElement(req, cb) {
        return this.request("DeleteAigcElement", req, cb);
    }
    async DescribeHunyuanToVideoJob(req, cb) {
        return this.request("DescribeHunyuanToVideoJob", req, cb);
    }
    async DescribeImageAnimateJob(req, cb) {
        return this.request("DescribeImageAnimateJob", req, cb);
    }
    async SubmitImageAnimateJob(req, cb) {
        return this.request("SubmitImageAnimateJob", req, cb);
    }
    async DescribeAigcElement(req, cb) {
        return this.request("DescribeAigcElement", req, cb);
    }
    async DescribeImageToVideoViduJob(req, cb) {
        return this.request("DescribeImageToVideoViduJob", req, cb);
    }
    async DescribeVideoStylizationJob(req, cb) {
        return this.request("DescribeVideoStylizationJob", req, cb);
    }
    async DescribeTextToVideoViduJob(req, cb) {
        return this.request("DescribeTextToVideoViduJob", req, cb);
    }
    async SubmitVideoEditKlingJob(req, cb) {
        return this.request("SubmitVideoEditKlingJob", req, cb);
    }
    async SubmitTextToVideoJob(req, cb) {
        return this.request("SubmitTextToVideoJob", req, cb);
    }
    async DescribeImageToVideoJob(req, cb) {
        return this.request("DescribeImageToVideoJob", req, cb);
    }
    async SubmitReferenceToVideoViduJob(req, cb) {
        return this.request("SubmitReferenceToVideoViduJob", req, cb);
    }
    async DescribeVideoFaceFusionJob(req, cb) {
        return this.request("DescribeVideoFaceFusionJob", req, cb);
    }
    async CreateAigcElement(req, cb) {
        return this.request("CreateAigcElement", req, cb);
    }
    async DescribeAigcVideoJob(req, cb) {
        return this.request("DescribeAigcVideoJob", req, cb);
    }
    async SubmitImageToVideoGeneralJob(req, cb) {
        return this.request("SubmitImageToVideoGeneralJob", req, cb);
    }
}
