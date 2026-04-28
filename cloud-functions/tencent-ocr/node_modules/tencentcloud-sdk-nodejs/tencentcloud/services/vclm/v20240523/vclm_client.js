"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Client = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars */
/*
 * Copyright (c) 2018 Tencent. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
const abstract_client_1 = require("../../../common/abstract_client");
/**
 * vclm client
 * @class
 */
class Client extends abstract_client_1.AbstractClient {
    constructor(clientConfig) {
        super("vclm.tencentcloudapi.com", "2024-05-23", clientConfig);
    }
    /**
     * ●混元生视频接口，基于混元大模型，根据输入的文本或图片智能生成视频。

●默认提供1个并发，代表最多能同时处理1个已提交的任务，上一个任务处理完毕后，才能开始处理下一个任务。
     */
    async SubmitHunyuanToVideoJob(req, cb) {
        return this.request("SubmitHunyuanToVideoJob", req, cb);
    }
    /**
     * 用于提交视频编辑任务，支持上传视频、文本及图片素材开展编辑操作，涵盖风格迁移、元素替换、内容增减等核心能力。
     */
    async DescribeVideoEditJob(req, cb) {
        return this.request("DescribeVideoEditJob", req, cb);
    }
    /**
     * 用于提交图片唱演任务。
支持提交音频和图片生成唱演视频，满足社交娱乐、互动营销等场景的需求。
     */
    async SubmitPortraitSingJob(req, cb) {
        return this.request("SubmitPortraitSingJob", req, cb);
    }
    /**
     * 查询Kling多模态编辑任务
     */
    async DescribeVideoEditKlingJob(req, cb) {
        return this.request("DescribeVideoEditKlingJob", req, cb);
    }
    /**
     * 用于查询文生视频任务。
     */
    async DescribeTextToVideoJob(req, cb) {
        return this.request("DescribeTextToVideoJob", req, cb);
    }
    /**
     * 提交Vidu文生视频任务接口
     */
    async SubmitTextToVideoViduJob(req, cb) {
        return this.request("SubmitTextToVideoViduJob", req, cb);
    }
    /**
     * 提交动作控制(Kling)任务并发
     */
    async SubmitMotionControlKlingJob(req, cb) {
        return this.request("SubmitMotionControlKlingJob", req, cb);
    }
    /**
     * 提交视频人脸融合任务
     */
    async SubmitVideoFaceFusionJob(req, cb) {
        return this.request("SubmitVideoFaceFusionJob", req, cb);
    }
    /**
     * 查询Vidu参考生视频任务接口
     */
    async DescribeReferenceToVideoViduJob(req, cb) {
        return this.request("DescribeReferenceToVideoViduJob", req, cb);
    }
    /**
     * 提交Vidu图生视频任务接口
     */
    async SubmitImageToVideoViduJob(req, cb) {
        return this.request("SubmitImageToVideoViduJob", req, cb);
    }
    /**
     * 检查图片跳舞输入图
     */
    async CheckAnimateImageJob(req, cb) {
        return this.request("CheckAnimateImageJob", req, cb);
    }
    /**
     * 用于提交视频延长任务接口。
     */
    async SubmitVideoExtendKlingJob(req, cb) {
        return this.request("SubmitVideoExtendKlingJob", req, cb);
    }
    /**
     * 查询图生视频通用能力任务接口
     */
    async DescribeImageToVideoGeneralJob(req, cb) {
        return this.request("DescribeImageToVideoGeneralJob", req, cb);
    }
    /**
     * 用于查询视频特效任务。
     */
    async DescribeTemplateToVideoJob(req, cb) {
        return this.request("DescribeTemplateToVideoJob", req, cb);
    }
    /**
     * 用于提交视频风格化任务。支持将输入视频生成特定风格的视频。生成后的视频画面风格多样、流畅自然，能够满足社交娱乐、互动营销、视频素材制作等场景的需求。
     */
    async SubmitVideoStylizationJob(req, cb) {
        return this.request("SubmitVideoStylizationJob", req, cb);
    }
    /**
     * 用于查询图片唱演任务。
支持提交音频和图片生成唱演视频，满足社交娱乐、互动营销等场景的需求。
     */
    async DescribePortraitSingJob(req, cb) {
        return this.request("DescribePortraitSingJob", req, cb);
    }
    /**
     * 查询Kling动作控制任务
     */
    async DescribeMotionControlKlingJob(req, cb) {
        return this.request("DescribeMotionControlKlingJob", req, cb);
    }
    /**
     * 查询视频延长任务
     */
    async DescribeVideoExtendKlingJob(req, cb) {
        return this.request("DescribeVideoExtendKlingJob", req, cb);
    }
    /**
     * 提交视频特效任务接口
     */
    async SubmitTemplateToVideoJob(req, cb) {
        return this.request("SubmitTemplateToVideoJob", req, cb);
    }
    /**
     * 用于提交视频编辑任务，支持上传视频、文本及图片素材开展编辑操作，涵盖风格迁移、元素替换、内容增减等核心能力。
     */
    async SubmitVideoEditJob(req, cb) {
        return this.request("SubmitVideoEditJob", req, cb);
    }
    /**
     * 通过JobId提交请求，获取视频配音频任务的结果信息。
     */
    async DescribeVideoVoiceJob(req, cb) {
        return this.request("DescribeVideoVoiceJob", req, cb);
    }
    /**
     * 提交视频特效任务接口
     */
    async SubmitImageToVideoJob(req, cb) {
        return this.request("SubmitImageToVideoJob", req, cb);
    }
    /**
     * 通过JobId提交请求，获取人像驱动任务的结果信息。
     */
    async DescribeHumanActorJob(req, cb) {
        return this.request("DescribeHumanActorJob", req, cb);
    }
    /**
     * 提交生视频任务
     */
    async SubmitAigcVideoJob(req, cb) {
        return this.request("SubmitAigcVideoJob", req, cb);
    }
    /**
     * 提交视频配音效任务，输入视频后提交请求，会返回一个JobId，用于查询视频配音效的处理进度。
     */
    async SubmitVideoVoiceJob(req, cb) {
        return this.request("SubmitVideoVoiceJob", req, cb);
    }
    /**
     * 用于提交人像驱动任务
支持提交音频和图文来生成对应视频，满足动态交互、内容生产等场景需求。
     */
    async SubmitHumanActorJob(req, cb) {
        return this.request("SubmitHumanActorJob", req, cb);
    }
    /**
     * 删除主体库
     */
    async DeleteAigcElement(req, cb) {
        return this.request("DeleteAigcElement", req, cb);
    }
    /**
     * 查询混元生视频任务
     */
    async DescribeHunyuanToVideoJob(req, cb) {
        return this.request("DescribeHunyuanToVideoJob", req, cb);
    }
    /**
     * 用于查询图片跳舞任务。图片跳舞能力支持舞蹈动作结合图片生成跳舞视频，满足社交娱乐、互动营销等场景的需求。
     */
    async DescribeImageAnimateJob(req, cb) {
        return this.request("DescribeImageAnimateJob", req, cb);
    }
    /**
     * 用于提交图片跳舞任务。图片跳舞能力支持舞蹈动作结合图片生成跳舞视频，满足社交娱乐、互动营销等场景的需求。
     */
    async SubmitImageAnimateJob(req, cb) {
        return this.request("SubmitImageAnimateJob", req, cb);
    }
    /**
     * 提交视频特效任务接口
     */
    async DescribeAigcElement(req, cb) {
        return this.request("DescribeAigcElement", req, cb);
    }
    /**
     * 查询Vidu图生视频任务接口
     */
    async DescribeImageToVideoViduJob(req, cb) {
        return this.request("DescribeImageToVideoViduJob", req, cb);
    }
    /**
     * 用于查询视频风格化任务。视频风格化支持将输入视频生成特定风格的视频。生成后的视频画面风格多样、流畅自然，能够满足社交娱乐、互动营销、视频素材制作等场景的需求。
     */
    async DescribeVideoStylizationJob(req, cb) {
        return this.request("DescribeVideoStylizationJob", req, cb);
    }
    /**
     * 查询Vidu文生视频任务接口
     */
    async DescribeTextToVideoViduJob(req, cb) {
        return this.request("DescribeTextToVideoViduJob", req, cb);
    }
    /**
     * 提交Kling多模态编辑任务
     */
    async SubmitVideoEditKlingJob(req, cb) {
        return this.request("SubmitVideoEditKlingJob", req, cb);
    }
    /**
     * 通过提交对视频内容的描述文本生成一个短视频。文生视频为异步处理任务，成功提交任务后返回任务的JobId。
     */
    async SubmitTextToVideoJob(req, cb) {
        return this.request("SubmitTextToVideoJob", req, cb);
    }
    /**
     * 用于查询视频特效任务。
     */
    async DescribeImageToVideoJob(req, cb) {
        return this.request("DescribeImageToVideoJob", req, cb);
    }
    /**
     * 提交Vidu参考生视频任务接口
     */
    async SubmitReferenceToVideoViduJob(req, cb) {
        return this.request("SubmitReferenceToVideoViduJob", req, cb);
    }
    /**
     * 查询视频人脸融合任务
     */
    async DescribeVideoFaceFusionJob(req, cb) {
        return this.request("DescribeVideoFaceFusionJob", req, cb);
    }
    /**
     * 提交视频特效任务接口
     */
    async CreateAigcElement(req, cb) {
        return this.request("CreateAigcElement", req, cb);
    }
    /**
     * 查询生视频任务
     */
    async DescribeAigcVideoJob(req, cb) {
        return this.request("DescribeAigcVideoJob", req, cb);
    }
    /**
     * 图生视频通用能力接口
     */
    async SubmitImageToVideoGeneralJob(req, cb) {
        return this.request("SubmitImageToVideoGeneralJob", req, cb);
    }
}
exports.Client = Client;
