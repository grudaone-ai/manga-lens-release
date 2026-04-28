import { AbstractClient } from "../../../common/abstract_client";
export class Client extends AbstractClient {
    constructor(clientConfig) {
        super("ga2.tencentcloudapi.com", "2025-01-15", clientConfig);
    }
    async DeleteEndpointGroups(req, cb) {
        return this.request("DeleteEndpointGroups", req, cb);
    }
    async CreateEndpointGroup(req, cb) {
        return this.request("CreateEndpointGroup", req, cb);
    }
    async DescribeAccelerateAreas(req, cb) {
        return this.request("DescribeAccelerateAreas", req, cb);
    }
    async DeleteGlobalAccelerator(req, cb) {
        return this.request("DeleteGlobalAccelerator", req, cb);
    }
    async DeleteListener(req, cb) {
        return this.request("DeleteListener", req, cb);
    }
    async DescribeCrossBorderSettlement(req, cb) {
        return this.request("DescribeCrossBorderSettlement", req, cb);
    }
    async ModifyListener(req, cb) {
        return this.request("ModifyListener", req, cb);
    }
    async DescribeAccelerateRegions(req, cb) {
        return this.request("DescribeAccelerateRegions", req, cb);
    }
    async ModifyForwardingRule(req, cb) {
        return this.request("ModifyForwardingRule", req, cb);
    }
    async DescribeEndpointGroups(req, cb) {
        return this.request("DescribeEndpointGroups", req, cb);
    }
    async DescribeListeners(req, cb) {
        return this.request("DescribeListeners", req, cb);
    }
    async DescribeGlobalAccelerators(req, cb) {
        return this.request("DescribeGlobalAccelerators", req, cb);
    }
    async DeleteAccelerateAreas(req, cb) {
        return this.request("DeleteAccelerateAreas", req, cb);
    }
    async CreateListener(req, cb) {
        return this.request("CreateListener", req, cb);
    }
    async CreateAccelerateAreas(req, cb) {
        return this.request("CreateAccelerateAreas", req, cb);
    }
    async ModifyEndpointGroup(req, cb) {
        return this.request("ModifyEndpointGroup", req, cb);
    }
    async DeleteForwardingRule(req, cb) {
        return this.request("DeleteForwardingRule", req, cb);
    }
    async CreateForwardingRule(req, cb) {
        return this.request("CreateForwardingRule", req, cb);
    }
    async CreateGlobalAccelerator(req, cb) {
        return this.request("CreateGlobalAccelerator", req, cb);
    }
    async ModifyAccelerateAreas(req, cb) {
        return this.request("ModifyAccelerateAreas", req, cb);
    }
    async ModifyGlobalAccelerator(req, cb) {
        return this.request("ModifyGlobalAccelerator", req, cb);
    }
    async DescribeForwardingRule(req, cb) {
        return this.request("DescribeForwardingRule", req, cb);
    }
}
