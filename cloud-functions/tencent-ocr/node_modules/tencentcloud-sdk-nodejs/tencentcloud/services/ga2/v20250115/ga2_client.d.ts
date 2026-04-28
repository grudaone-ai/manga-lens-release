import { AbstractClient } from "../../../common/abstract_client";
import { ClientConfig } from "../../../common/interface";
import { CreateAccelerateAreasResponse, DescribeListenersResponse, ModifyListenerResponse, DescribeForwardingRuleRequest, DescribeEndpointGroupsResponse, ModifyGlobalAcceleratorRequest, CreateForwardingRuleRequest, ModifyEndpointGroupResponse, CreateListenerResponse, CreateGlobalAcceleratorRequest, DescribeCrossBorderSettlementRequest, DescribeGlobalAcceleratorsRequest, DescribeAccelerateAreasRequest, ModifyAccelerateAreasRequest, DescribeCrossBorderSettlementResponse, DescribeForwardingRuleResponse, DeleteAccelerateAreasRequest, DeleteAccelerateAreasResponse, ModifyAccelerateAreasResponse, DeleteGlobalAcceleratorRequest, DeleteEndpointGroupsResponse, ModifyForwardingRuleRequest, ModifyListenerRequest, DescribeEndpointGroupsRequest, CreateAccelerateAreasRequest, CreateListenerRequest, ModifyForwardingRuleResponse, DeleteForwardingRuleRequest, DescribeAccelerateAreasResponse, DeleteListenerRequest, ModifyGlobalAcceleratorResponse, DescribeListenersRequest, DescribeAccelerateRegionsRequest, DeleteForwardingRuleResponse, DeleteEndpointGroupsRequest, DeleteListenerResponse, ModifyEndpointGroupRequest, CreateEndpointGroupRequest, CreateEndpointGroupResponse, DeleteGlobalAcceleratorResponse, DescribeAccelerateRegionsResponse, CreateGlobalAcceleratorResponse, DescribeGlobalAcceleratorsResponse, CreateForwardingRuleResponse } from "./ga2_models";
/**
 * ga2 client
 * @class
 */
export declare class Client extends AbstractClient {
    constructor(clientConfig: ClientConfig);
    /**
     * 删除终端节点组。
     */
    DeleteEndpointGroups(req: DeleteEndpointGroupsRequest, cb?: (error: string, rep: DeleteEndpointGroupsResponse) => void): Promise<DeleteEndpointGroupsResponse>;
    /**
     * 创建终端节点组。
     */
    CreateEndpointGroup(req: CreateEndpointGroupRequest, cb?: (error: string, rep: CreateEndpointGroupResponse) => void): Promise<CreateEndpointGroupResponse>;
    /**
     * 查询加速地域
     */
    DescribeAccelerateAreas(req: DescribeAccelerateAreasRequest, cb?: (error: string, rep: DescribeAccelerateAreasResponse) => void): Promise<DescribeAccelerateAreasResponse>;
    /**
     * 删除全球加速实例
     */
    DeleteGlobalAccelerator(req: DeleteGlobalAcceleratorRequest, cb?: (error: string, rep: DeleteGlobalAcceleratorResponse) => void): Promise<DeleteGlobalAcceleratorResponse>;
    /**
     * 删除监听器
     */
    DeleteListener(req: DeleteListenerRequest, cb?: (error: string, rep: DeleteListenerResponse) => void): Promise<DeleteListenerResponse>;
    /**
     * 查询跨境账单
     */
    DescribeCrossBorderSettlement(req: DescribeCrossBorderSettlementRequest, cb?: (error: string, rep: DescribeCrossBorderSettlementResponse) => void): Promise<DescribeCrossBorderSettlementResponse>;
    /**
     * 修改监听器
     */
    ModifyListener(req: ModifyListenerRequest, cb?: (error: string, rep: ModifyListenerResponse) => void): Promise<ModifyListenerResponse>;
    /**
     * 查询可选加速区域
     */
    DescribeAccelerateRegions(req?: DescribeAccelerateRegionsRequest, cb?: (error: string, rep: DescribeAccelerateRegionsResponse) => void): Promise<DescribeAccelerateRegionsResponse>;
    /**
     * 修改七层转发规则
     */
    ModifyForwardingRule(req: ModifyForwardingRuleRequest, cb?: (error: string, rep: ModifyForwardingRuleResponse) => void): Promise<ModifyForwardingRuleResponse>;
    /**
     * 查询终端节点组。
     */
    DescribeEndpointGroups(req: DescribeEndpointGroupsRequest, cb?: (error: string, rep: DescribeEndpointGroupsResponse) => void): Promise<DescribeEndpointGroupsResponse>;
    /**
     * 查询监听器
     */
    DescribeListeners(req: DescribeListenersRequest, cb?: (error: string, rep: DescribeListenersResponse) => void): Promise<DescribeListenersResponse>;
    /**
     * 修改全球加速实例
     */
    DescribeGlobalAccelerators(req: DescribeGlobalAcceleratorsRequest, cb?: (error: string, rep: DescribeGlobalAcceleratorsResponse) => void): Promise<DescribeGlobalAcceleratorsResponse>;
    /**
     * 删除加速地域
     */
    DeleteAccelerateAreas(req: DeleteAccelerateAreasRequest, cb?: (error: string, rep: DeleteAccelerateAreasResponse) => void): Promise<DeleteAccelerateAreasResponse>;
    /**
     * 创建监听器
     */
    CreateListener(req: CreateListenerRequest, cb?: (error: string, rep: CreateListenerResponse) => void): Promise<CreateListenerResponse>;
    /**
     * 创建加速地域
     */
    CreateAccelerateAreas(req: CreateAccelerateAreasRequest, cb?: (error: string, rep: CreateAccelerateAreasResponse) => void): Promise<CreateAccelerateAreasResponse>;
    /**
     * 修改终端节点组。
     */
    ModifyEndpointGroup(req: ModifyEndpointGroupRequest, cb?: (error: string, rep: ModifyEndpointGroupResponse) => void): Promise<ModifyEndpointGroupResponse>;
    /**
     * 删除七层转发规则
     */
    DeleteForwardingRule(req: DeleteForwardingRuleRequest, cb?: (error: string, rep: DeleteForwardingRuleResponse) => void): Promise<DeleteForwardingRuleResponse>;
    /**
     * 创建七层转发规则
     */
    CreateForwardingRule(req: CreateForwardingRuleRequest, cb?: (error: string, rep: CreateForwardingRuleResponse) => void): Promise<CreateForwardingRuleResponse>;
    /**
     * 创建全球加速实例
     */
    CreateGlobalAccelerator(req: CreateGlobalAcceleratorRequest, cb?: (error: string, rep: CreateGlobalAcceleratorResponse) => void): Promise<CreateGlobalAcceleratorResponse>;
    /**
     * 修改加速地域
     */
    ModifyAccelerateAreas(req: ModifyAccelerateAreasRequest, cb?: (error: string, rep: ModifyAccelerateAreasResponse) => void): Promise<ModifyAccelerateAreasResponse>;
    /**
     * 修改全球加速实例
     */
    ModifyGlobalAccelerator(req: ModifyGlobalAcceleratorRequest, cb?: (error: string, rep: ModifyGlobalAcceleratorResponse) => void): Promise<ModifyGlobalAcceleratorResponse>;
    /**
     * 查看七层转发规则
     */
    DescribeForwardingRule(req: DescribeForwardingRuleRequest, cb?: (error: string, rep: DescribeForwardingRuleResponse) => void): Promise<DescribeForwardingRuleResponse>;
}
