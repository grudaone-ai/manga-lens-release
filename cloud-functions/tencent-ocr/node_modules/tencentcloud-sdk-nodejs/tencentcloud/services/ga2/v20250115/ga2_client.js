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
 * ga2 client
 * @class
 */
class Client extends abstract_client_1.AbstractClient {
    constructor(clientConfig) {
        super("ga2.tencentcloudapi.com", "2025-01-15", clientConfig);
    }
    /**
     * 删除终端节点组。
     */
    async DeleteEndpointGroups(req, cb) {
        return this.request("DeleteEndpointGroups", req, cb);
    }
    /**
     * 创建终端节点组。
     */
    async CreateEndpointGroup(req, cb) {
        return this.request("CreateEndpointGroup", req, cb);
    }
    /**
     * 查询加速地域
     */
    async DescribeAccelerateAreas(req, cb) {
        return this.request("DescribeAccelerateAreas", req, cb);
    }
    /**
     * 删除全球加速实例
     */
    async DeleteGlobalAccelerator(req, cb) {
        return this.request("DeleteGlobalAccelerator", req, cb);
    }
    /**
     * 删除监听器
     */
    async DeleteListener(req, cb) {
        return this.request("DeleteListener", req, cb);
    }
    /**
     * 查询跨境账单
     */
    async DescribeCrossBorderSettlement(req, cb) {
        return this.request("DescribeCrossBorderSettlement", req, cb);
    }
    /**
     * 修改监听器
     */
    async ModifyListener(req, cb) {
        return this.request("ModifyListener", req, cb);
    }
    /**
     * 查询可选加速区域
     */
    async DescribeAccelerateRegions(req, cb) {
        return this.request("DescribeAccelerateRegions", req, cb);
    }
    /**
     * 修改七层转发规则
     */
    async ModifyForwardingRule(req, cb) {
        return this.request("ModifyForwardingRule", req, cb);
    }
    /**
     * 查询终端节点组。
     */
    async DescribeEndpointGroups(req, cb) {
        return this.request("DescribeEndpointGroups", req, cb);
    }
    /**
     * 查询监听器
     */
    async DescribeListeners(req, cb) {
        return this.request("DescribeListeners", req, cb);
    }
    /**
     * 修改全球加速实例
     */
    async DescribeGlobalAccelerators(req, cb) {
        return this.request("DescribeGlobalAccelerators", req, cb);
    }
    /**
     * 删除加速地域
     */
    async DeleteAccelerateAreas(req, cb) {
        return this.request("DeleteAccelerateAreas", req, cb);
    }
    /**
     * 创建监听器
     */
    async CreateListener(req, cb) {
        return this.request("CreateListener", req, cb);
    }
    /**
     * 创建加速地域
     */
    async CreateAccelerateAreas(req, cb) {
        return this.request("CreateAccelerateAreas", req, cb);
    }
    /**
     * 修改终端节点组。
     */
    async ModifyEndpointGroup(req, cb) {
        return this.request("ModifyEndpointGroup", req, cb);
    }
    /**
     * 删除七层转发规则
     */
    async DeleteForwardingRule(req, cb) {
        return this.request("DeleteForwardingRule", req, cb);
    }
    /**
     * 创建七层转发规则
     */
    async CreateForwardingRule(req, cb) {
        return this.request("CreateForwardingRule", req, cb);
    }
    /**
     * 创建全球加速实例
     */
    async CreateGlobalAccelerator(req, cb) {
        return this.request("CreateGlobalAccelerator", req, cb);
    }
    /**
     * 修改加速地域
     */
    async ModifyAccelerateAreas(req, cb) {
        return this.request("ModifyAccelerateAreas", req, cb);
    }
    /**
     * 修改全球加速实例
     */
    async ModifyGlobalAccelerator(req, cb) {
        return this.request("ModifyGlobalAccelerator", req, cb);
    }
    /**
     * 查看七层转发规则
     */
    async DescribeForwardingRule(req, cb) {
        return this.request("DescribeForwardingRule", req, cb);
    }
}
exports.Client = Client;
