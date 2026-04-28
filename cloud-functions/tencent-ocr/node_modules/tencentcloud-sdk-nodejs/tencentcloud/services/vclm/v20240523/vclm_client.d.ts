import { AbstractClient } from "../../../common/abstract_client";
import { ClientConfig } from "../../../common/interface";
import { DescribeImageToVideoGeneralJobResponse, SubmitVideoStylizationJobRequest, SubmitImageToVideoJobRequest, DescribeVideoVoiceJobResponse, SubmitHumanActorJobRequest, DescribeImageToVideoViduJobResponse, SubmitTextToVideoViduJobRequest, SubmitVideoEditJobRequest, DescribeVideoExtendKlingJobRequest, SubmitVideoEditKlingJobRequest, DescribeAigcElementResponse, SubmitImageAnimateJobResponse, SubmitVideoFaceFusionJobResponse, DescribeTemplateToVideoJobResponse, DescribeReferenceToVideoViduJobResponse, SubmitMotionControlKlingJobRequest, SubmitVideoExtendKlingJobRequest, SubmitTemplateToVideoJobResponse, DeleteAigcElementResponse, DescribeVideoEditKlingJobRequest, SubmitVideoVoiceJobRequest, DescribeTextToVideoJobResponse, DescribeVideoEditJobResponse, SubmitVideoStylizationJobResponse, SubmitVideoFaceFusionJobRequest, SubmitReferenceToVideoViduJobRequest, SubmitImageToVideoGeneralJobRequest, SubmitImageToVideoViduJobRequest, DescribeHumanActorJobRequest, DescribeImageToVideoGeneralJobRequest, SubmitAigcVideoJobResponse, SubmitVideoVoiceJobResponse, DeleteAigcElementRequest, SubmitImageToVideoViduJobResponse, SubmitPortraitSingJobResponse, CreateAigcElementResponse, DescribeImageToVideoJobResponse, DescribePortraitSingJobRequest, DescribeHunyuanToVideoJobRequest, SubmitTextToVideoViduJobResponse, CheckAnimateImageJobResponse, SubmitVideoEditJobResponse, DescribeVideoStylizationJobRequest, SubmitHumanActorJobResponse, DescribeMotionControlKlingJobResponse, SubmitAigcVideoJobRequest, SubmitReferenceToVideoViduJobResponse, DescribeAigcVideoJobRequest, SubmitImageAnimateJobRequest, SubmitTextToVideoJobResponse, DescribeVideoFaceFusionJobRequest, DescribeImageToVideoViduJobRequest, SubmitVideoEditKlingJobResponse, DescribeReferenceToVideoViduJobRequest, DescribeImageAnimateJobResponse, DescribeAigcVideoJobResponse, SubmitVideoExtendKlingJobResponse, DescribeHumanActorJobResponse, SubmitMotionControlKlingJobResponse, CreateAigcElementRequest, SubmitTemplateToVideoJobRequest, DescribeTextToVideoJobRequest, DescribeImageToVideoJobRequest, DescribeTemplateToVideoJobRequest, DescribeMotionControlKlingJobRequest, DescribeImageAnimateJobRequest, DescribePortraitSingJobResponse, DescribeHunyuanToVideoJobResponse, DescribeTextToVideoViduJobRequest, DescribeTextToVideoViduJobResponse, DescribeVideoVoiceJobRequest, DescribeVideoFaceFusionJobResponse, SubmitImageToVideoGeneralJobResponse, DescribeAigcElementRequest, CheckAnimateImageJobRequest, DescribeVideoExtendKlingJobResponse, SubmitPortraitSingJobRequest, SubmitHunyuanToVideoJobResponse, SubmitTextToVideoJobRequest, DescribeVideoStylizationJobResponse, SubmitHunyuanToVideoJobRequest, DescribeVideoEditJobRequest, DescribeVideoEditKlingJobResponse, SubmitImageToVideoJobResponse } from "./vclm_models";
/**
 * vclm client
 * @class
 */
export declare class Client extends AbstractClient {
    constructor(clientConfig: ClientConfig);
    /**
     * ●混元生视频接口，基于混元大模型，根据输入的文本或图片智能生成视频。

●默认提供1个并发，代表最多能同时处理1个已提交的任务，上一个任务处理完毕后，才能开始处理下一个任务。
     */
    SubmitHunyuanToVideoJob(req: SubmitHunyuanToVideoJobRequest, cb?: (error: string, rep: SubmitHunyuanToVideoJobResponse) => void): Promise<SubmitHunyuanToVideoJobResponse>;
    /**
     * 用于提交视频编辑任务，支持上传视频、文本及图片素材开展编辑操作，涵盖风格迁移、元素替换、内容增减等核心能力。
     */
    DescribeVideoEditJob(req: DescribeVideoEditJobRequest, cb?: (error: string, rep: DescribeVideoEditJobResponse) => void): Promise<DescribeVideoEditJobResponse>;
    /**
     * 用于提交图片唱演任务。
支持提交音频和图片生成唱演视频，满足社交娱乐、互动营销等场景的需求。
     */
    SubmitPortraitSingJob(req: SubmitPortraitSingJobRequest, cb?: (error: string, rep: SubmitPortraitSingJobResponse) => void): Promise<SubmitPortraitSingJobResponse>;
    /**
     * 查询Kling多模态编辑任务
     */
    DescribeVideoEditKlingJob(req: DescribeVideoEditKlingJobRequest, cb?: (error: string, rep: DescribeVideoEditKlingJobResponse) => void): Promise<DescribeVideoEditKlingJobResponse>;
    /**
     * 用于查询文生视频任务。
     */
    DescribeTextToVideoJob(req: DescribeTextToVideoJobRequest, cb?: (error: string, rep: DescribeTextToVideoJobResponse) => void): Promise<DescribeTextToVideoJobResponse>;
    /**
     * 提交Vidu文生视频任务接口
     */
    SubmitTextToVideoViduJob(req: SubmitTextToVideoViduJobRequest, cb?: (error: string, rep: SubmitTextToVideoViduJobResponse) => void): Promise<SubmitTextToVideoViduJobResponse>;
    /**
     * 提交动作控制(Kling)任务并发
     */
    SubmitMotionControlKlingJob(req: SubmitMotionControlKlingJobRequest, cb?: (error: string, rep: SubmitMotionControlKlingJobResponse) => void): Promise<SubmitMotionControlKlingJobResponse>;
    /**
     * 提交视频人脸融合任务
     */
    SubmitVideoFaceFusionJob(req: SubmitVideoFaceFusionJobRequest, cb?: (error: string, rep: SubmitVideoFaceFusionJobResponse) => void): Promise<SubmitVideoFaceFusionJobResponse>;
    /**
     * 查询Vidu参考生视频任务接口
     */
    DescribeReferenceToVideoViduJob(req: DescribeReferenceToVideoViduJobRequest, cb?: (error: string, rep: DescribeReferenceToVideoViduJobResponse) => void): Promise<DescribeReferenceToVideoViduJobResponse>;
    /**
     * 提交Vidu图生视频任务接口
     */
    SubmitImageToVideoViduJob(req: SubmitImageToVideoViduJobRequest, cb?: (error: string, rep: SubmitImageToVideoViduJobResponse) => void): Promise<SubmitImageToVideoViduJobResponse>;
    /**
     * 检查图片跳舞输入图
     */
    CheckAnimateImageJob(req: CheckAnimateImageJobRequest, cb?: (error: string, rep: CheckAnimateImageJobResponse) => void): Promise<CheckAnimateImageJobResponse>;
    /**
     * 用于提交视频延长任务接口。
     */
    SubmitVideoExtendKlingJob(req: SubmitVideoExtendKlingJobRequest, cb?: (error: string, rep: SubmitVideoExtendKlingJobResponse) => void): Promise<SubmitVideoExtendKlingJobResponse>;
    /**
     * 查询图生视频通用能力任务接口
     */
    DescribeImageToVideoGeneralJob(req: DescribeImageToVideoGeneralJobRequest, cb?: (error: string, rep: DescribeImageToVideoGeneralJobResponse) => void): Promise<DescribeImageToVideoGeneralJobResponse>;
    /**
     * 用于查询视频特效任务。
     */
    DescribeTemplateToVideoJob(req: DescribeTemplateToVideoJobRequest, cb?: (error: string, rep: DescribeTemplateToVideoJobResponse) => void): Promise<DescribeTemplateToVideoJobResponse>;
    /**
     * 用于提交视频风格化任务。支持将输入视频生成特定风格的视频。生成后的视频画面风格多样、流畅自然，能够满足社交娱乐、互动营销、视频素材制作等场景的需求。
     */
    SubmitVideoStylizationJob(req: SubmitVideoStylizationJobRequest, cb?: (error: string, rep: SubmitVideoStylizationJobResponse) => void): Promise<SubmitVideoStylizationJobResponse>;
    /**
     * 用于查询图片唱演任务。
支持提交音频和图片生成唱演视频，满足社交娱乐、互动营销等场景的需求。
     */
    DescribePortraitSingJob(req: DescribePortraitSingJobRequest, cb?: (error: string, rep: DescribePortraitSingJobResponse) => void): Promise<DescribePortraitSingJobResponse>;
    /**
     * 查询Kling动作控制任务
     */
    DescribeMotionControlKlingJob(req: DescribeMotionControlKlingJobRequest, cb?: (error: string, rep: DescribeMotionControlKlingJobResponse) => void): Promise<DescribeMotionControlKlingJobResponse>;
    /**
     * 查询视频延长任务
     */
    DescribeVideoExtendKlingJob(req: DescribeVideoExtendKlingJobRequest, cb?: (error: string, rep: DescribeVideoExtendKlingJobResponse) => void): Promise<DescribeVideoExtendKlingJobResponse>;
    /**
     * 提交视频特效任务接口
     */
    SubmitTemplateToVideoJob(req: SubmitTemplateToVideoJobRequest, cb?: (error: string, rep: SubmitTemplateToVideoJobResponse) => void): Promise<SubmitTemplateToVideoJobResponse>;
    /**
     * 用于提交视频编辑任务，支持上传视频、文本及图片素材开展编辑操作，涵盖风格迁移、元素替换、内容增减等核心能力。
     */
    SubmitVideoEditJob(req: SubmitVideoEditJobRequest, cb?: (error: string, rep: SubmitVideoEditJobResponse) => void): Promise<SubmitVideoEditJobResponse>;
    /**
     * 通过JobId提交请求，获取视频配音频任务的结果信息。
     */
    DescribeVideoVoiceJob(req: DescribeVideoVoiceJobRequest, cb?: (error: string, rep: DescribeVideoVoiceJobResponse) => void): Promise<DescribeVideoVoiceJobResponse>;
    /**
     * 提交视频特效任务接口
     */
    SubmitImageToVideoJob(req: SubmitImageToVideoJobRequest, cb?: (error: string, rep: SubmitImageToVideoJobResponse) => void): Promise<SubmitImageToVideoJobResponse>;
    /**
     * 通过JobId提交请求，获取人像驱动任务的结果信息。
     */
    DescribeHumanActorJob(req: DescribeHumanActorJobRequest, cb?: (error: string, rep: DescribeHumanActorJobResponse) => void): Promise<DescribeHumanActorJobResponse>;
    /**
     * 提交生视频任务
     */
    SubmitAigcVideoJob(req: SubmitAigcVideoJobRequest, cb?: (error: string, rep: SubmitAigcVideoJobResponse) => void): Promise<SubmitAigcVideoJobResponse>;
    /**
     * 提交视频配音效任务，输入视频后提交请求，会返回一个JobId，用于查询视频配音效的处理进度。
     */
    SubmitVideoVoiceJob(req: SubmitVideoVoiceJobRequest, cb?: (error: string, rep: SubmitVideoVoiceJobResponse) => void): Promise<SubmitVideoVoiceJobResponse>;
    /**
     * 用于提交人像驱动任务
支持提交音频和图文来生成对应视频，满足动态交互、内容生产等场景需求。
     */
    SubmitHumanActorJob(req: SubmitHumanActorJobRequest, cb?: (error: string, rep: SubmitHumanActorJobResponse) => void): Promise<SubmitHumanActorJobResponse>;
    /**
     * 删除主体库
     */
    DeleteAigcElement(req: DeleteAigcElementRequest, cb?: (error: string, rep: DeleteAigcElementResponse) => void): Promise<DeleteAigcElementResponse>;
    /**
     * 查询混元生视频任务
     */
    DescribeHunyuanToVideoJob(req: DescribeHunyuanToVideoJobRequest, cb?: (error: string, rep: DescribeHunyuanToVideoJobResponse) => void): Promise<DescribeHunyuanToVideoJobResponse>;
    /**
     * 用于查询图片跳舞任务。图片跳舞能力支持舞蹈动作结合图片生成跳舞视频，满足社交娱乐、互动营销等场景的需求。
     */
    DescribeImageAnimateJob(req: DescribeImageAnimateJobRequest, cb?: (error: string, rep: DescribeImageAnimateJobResponse) => void): Promise<DescribeImageAnimateJobResponse>;
    /**
     * 用于提交图片跳舞任务。图片跳舞能力支持舞蹈动作结合图片生成跳舞视频，满足社交娱乐、互动营销等场景的需求。
     */
    SubmitImageAnimateJob(req: SubmitImageAnimateJobRequest, cb?: (error: string, rep: SubmitImageAnimateJobResponse) => void): Promise<SubmitImageAnimateJobResponse>;
    /**
     * 提交视频特效任务接口
     */
    DescribeAigcElement(req: DescribeAigcElementRequest, cb?: (error: string, rep: DescribeAigcElementResponse) => void): Promise<DescribeAigcElementResponse>;
    /**
     * 查询Vidu图生视频任务接口
     */
    DescribeImageToVideoViduJob(req: DescribeImageToVideoViduJobRequest, cb?: (error: string, rep: DescribeImageToVideoViduJobResponse) => void): Promise<DescribeImageToVideoViduJobResponse>;
    /**
     * 用于查询视频风格化任务。视频风格化支持将输入视频生成特定风格的视频。生成后的视频画面风格多样、流畅自然，能够满足社交娱乐、互动营销、视频素材制作等场景的需求。
     */
    DescribeVideoStylizationJob(req: DescribeVideoStylizationJobRequest, cb?: (error: string, rep: DescribeVideoStylizationJobResponse) => void): Promise<DescribeVideoStylizationJobResponse>;
    /**
     * 查询Vidu文生视频任务接口
     */
    DescribeTextToVideoViduJob(req: DescribeTextToVideoViduJobRequest, cb?: (error: string, rep: DescribeTextToVideoViduJobResponse) => void): Promise<DescribeTextToVideoViduJobResponse>;
    /**
     * 提交Kling多模态编辑任务
     */
    SubmitVideoEditKlingJob(req: SubmitVideoEditKlingJobRequest, cb?: (error: string, rep: SubmitVideoEditKlingJobResponse) => void): Promise<SubmitVideoEditKlingJobResponse>;
    /**
     * 通过提交对视频内容的描述文本生成一个短视频。文生视频为异步处理任务，成功提交任务后返回任务的JobId。
     */
    SubmitTextToVideoJob(req: SubmitTextToVideoJobRequest, cb?: (error: string, rep: SubmitTextToVideoJobResponse) => void): Promise<SubmitTextToVideoJobResponse>;
    /**
     * 用于查询视频特效任务。
     */
    DescribeImageToVideoJob(req: DescribeImageToVideoJobRequest, cb?: (error: string, rep: DescribeImageToVideoJobResponse) => void): Promise<DescribeImageToVideoJobResponse>;
    /**
     * 提交Vidu参考生视频任务接口
     */
    SubmitReferenceToVideoViduJob(req: SubmitReferenceToVideoViduJobRequest, cb?: (error: string, rep: SubmitReferenceToVideoViduJobResponse) => void): Promise<SubmitReferenceToVideoViduJobResponse>;
    /**
     * 查询视频人脸融合任务
     */
    DescribeVideoFaceFusionJob(req: DescribeVideoFaceFusionJobRequest, cb?: (error: string, rep: DescribeVideoFaceFusionJobResponse) => void): Promise<DescribeVideoFaceFusionJobResponse>;
    /**
     * 提交视频特效任务接口
     */
    CreateAigcElement(req: CreateAigcElementRequest, cb?: (error: string, rep: CreateAigcElementResponse) => void): Promise<CreateAigcElementResponse>;
    /**
     * 查询生视频任务
     */
    DescribeAigcVideoJob(req: DescribeAigcVideoJobRequest, cb?: (error: string, rep: DescribeAigcVideoJobResponse) => void): Promise<DescribeAigcVideoJobResponse>;
    /**
     * 图生视频通用能力接口
     */
    SubmitImageToVideoGeneralJob(req: SubmitImageToVideoGeneralJobRequest, cb?: (error: string, rep: SubmitImageToVideoGeneralJobResponse) => void): Promise<SubmitImageToVideoGeneralJobResponse>;
}
