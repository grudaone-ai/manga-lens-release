import { AbstractClient } from "../../../common/abstract_client";
import { ClientConfig } from "../../../common/interface";
import { CreateModelServiceRequest, ModifyAgentAppRequest, CreateAgentAppResponse, DescribeAgentAppModelServicesRequest, DeleteAgentCredentialResponse, DescribeMcpServerResponse, DeleteModelServiceResponse, DeleteModelResponse, ModifyModelServiceRequest, ModifyModelResponse, CreateAgentAppModelServicesRequest, DeleteMcpServerResponse, DescribeAgentCredentialsRequest, CreateMcpServerResponse, DescribeAgentAppsRequest, DescribeAgentAppResponse, CreateModelRequest, DescribeModelRequest, DeleteAgentAppModelServicesResponse, CreateModelResponse, DescribeMcpServersRequest, DescribeAgentAppsResponse, ModifyAgentAppResponse, DescribeModelServiceResponse, DescribeAgentCredentialResponse, ModifyAgentAppModelServicesRequest, DescribeModelServiceRequest, DeleteAgentAppMcpServersRequest, CreateMcpServerRequest, DeleteModelServiceRequest, DeleteAgentAppRequest, DeleteMcpServerRequest, ModifyModelRequest, CreateAgentAppModelServicesResponse, DescribeAgentAppMcpServersResponse, DescribeModelServicesRequest, DescribeMcpServerRequest, ModifyAgentAppModelServicesResponse, DeleteAgentAppModelServicesRequest, ModifyAgentCredentialResponse, DeleteAgentCredentialRequest, ModifyModelServiceResponse, CreateAgentAppMcpServersRequest, DescribeMcpServersResponse, ModifyAgentCredentialRequest, CreateAgentAppRequest, CreateModelServiceResponse, DescribeAgentCredentialsResponse, DeleteAgentAppMcpServersResponse, DescribeModelsRequest, DescribeAgentCredentialRequest, CreateAgentCredentialRequest, CreateAgentAppMcpServersResponse, ModifyMcpServerRequest, DescribeModelResponse, DescribeAgentAppMcpServersRequest, DescribeAgentAppRequest, DeleteAgentAppResponse, CreateAgentCredentialResponse, DescribeAgentAppModelServicesResponse, ModifyMcpServerResponse, DeleteModelRequest, DescribeModelsResponse, DescribeModelServicesResponse } from "./apis_models";
/**
 * apis client
 * @class
 */
export declare class Client extends AbstractClient {
    constructor(clientConfig: ClientConfig);
    /**
     * 查询Credential详情
     */
    DescribeAgentCredential(req?: DescribeAgentCredentialRequest, cb?: (error: string, rep: DescribeAgentCredentialResponse) => void): Promise<DescribeAgentCredentialResponse>;
    /**
     * 查询app列表
     */
    DescribeAgentApps(req: DescribeAgentAppsRequest, cb?: (error: string, rep: DescribeAgentAppsResponse) => void): Promise<DescribeAgentAppsResponse>;
    /**
     * 查询模型详情
     */
    DescribeModel(req: DescribeModelRequest, cb?: (error: string, rep: DescribeModelResponse) => void): Promise<DescribeModelResponse>;
    /**
     * 删除app的mcp server
     */
    DeleteAgentAppMcpServers(req: DeleteAgentAppMcpServersRequest, cb?: (error: string, rep: DeleteAgentAppMcpServersResponse) => void): Promise<DeleteAgentAppMcpServersResponse>;
    /**
     * 查询模型服务详情
     */
    DescribeModelService(req: DescribeModelServiceRequest, cb?: (error: string, rep: DescribeModelServiceResponse) => void): Promise<DescribeModelServiceResponse>;
    /**
     * 查询Credential列表
     */
    DescribeAgentCredentials(req?: DescribeAgentCredentialsRequest, cb?: (error: string, rep: DescribeAgentCredentialsResponse) => void): Promise<DescribeAgentCredentialsResponse>;
    /**
     * 创建app的mcp server关联
     */
    CreateAgentAppMcpServers(req: CreateAgentAppMcpServersRequest, cb?: (error: string, rep: CreateAgentAppMcpServersResponse) => void): Promise<CreateAgentAppMcpServersResponse>;
    /**
     * 查询app详情
     */
    DescribeAgentApp(req: DescribeAgentAppRequest, cb?: (error: string, rep: DescribeAgentAppResponse) => void): Promise<DescribeAgentAppResponse>;
    /**
     * 查询app mcpServer关联列表
     */
    DescribeAgentAppMcpServers(req: DescribeAgentAppMcpServersRequest, cb?: (error: string, rep: DescribeAgentAppMcpServersResponse) => void): Promise<DescribeAgentAppMcpServersResponse>;
    /**
     * 修改模型
     */
    ModifyModel(req: ModifyModelRequest, cb?: (error: string, rep: ModifyModelResponse) => void): Promise<ModifyModelResponse>;
    /**
     * 查询mcp server详情
     */
    DescribeMcpServer(req: DescribeMcpServerRequest, cb?: (error: string, rep: DescribeMcpServerResponse) => void): Promise<DescribeMcpServerResponse>;
    /**
     * 修改Credential
     */
    ModifyAgentCredential(req?: ModifyAgentCredentialRequest, cb?: (error: string, rep: ModifyAgentCredentialResponse) => void): Promise<ModifyAgentCredentialResponse>;
    /**
     * 删除mcp server
     */
    DeleteMcpServer(req: DeleteMcpServerRequest, cb?: (error: string, rep: DeleteMcpServerResponse) => void): Promise<DeleteMcpServerResponse>;
    /**
     * 查询mcp server列表
     */
    DescribeMcpServers(req: DescribeMcpServersRequest, cb?: (error: string, rep: DescribeMcpServersResponse) => void): Promise<DescribeMcpServersResponse>;
    /**
     * 修改mcp server
     */
    ModifyMcpServer(req: ModifyMcpServerRequest, cb?: (error: string, rep: ModifyMcpServerResponse) => void): Promise<ModifyMcpServerResponse>;
    /**
     * 创建app
     */
    CreateAgentApp(req: CreateAgentAppRequest, cb?: (error: string, rep: CreateAgentAppResponse) => void): Promise<CreateAgentAppResponse>;
    /**
     * 查询app modelService关联列表
     */
    DescribeAgentAppModelServices(req?: DescribeAgentAppModelServicesRequest, cb?: (error: string, rep: DescribeAgentAppModelServicesResponse) => void): Promise<DescribeAgentAppModelServicesResponse>;
    /**
     * 删除app的model service关联
     */
    DeleteAgentAppModelServices(req: DeleteAgentAppModelServicesRequest, cb?: (error: string, rep: DeleteAgentAppModelServicesResponse) => void): Promise<DeleteAgentAppModelServicesResponse>;
    /**
     * 创建模型服务
     */
    CreateModelService(req: CreateModelServiceRequest, cb?: (error: string, rep: CreateModelServiceResponse) => void): Promise<CreateModelServiceResponse>;
    /**
     * 创建Credential
     */
    CreateAgentCredential(req?: CreateAgentCredentialRequest, cb?: (error: string, rep: CreateAgentCredentialResponse) => void): Promise<CreateAgentCredentialResponse>;
    /**
     * 删除Credential
     */
    DeleteAgentCredential(req?: DeleteAgentCredentialRequest, cb?: (error: string, rep: DeleteAgentCredentialResponse) => void): Promise<DeleteAgentCredentialResponse>;
    /**
     * 创建app的model service关联
     */
    CreateAgentAppModelServices(req: CreateAgentAppModelServicesRequest, cb?: (error: string, rep: CreateAgentAppModelServicesResponse) => void): Promise<CreateAgentAppModelServicesResponse>;
    /**
     * 删除模型服务
     */
    DeleteModelService(req: DeleteModelServiceRequest, cb?: (error: string, rep: DeleteModelServiceResponse) => void): Promise<DeleteModelServiceResponse>;
    /**
     * 查询模型列表
     */
    DescribeModels(req: DescribeModelsRequest, cb?: (error: string, rep: DescribeModelsResponse) => void): Promise<DescribeModelsResponse>;
    /**
     * 修改app
     */
    ModifyAgentApp(req: ModifyAgentAppRequest, cb?: (error: string, rep: ModifyAgentAppResponse) => void): Promise<ModifyAgentAppResponse>;
    /**
     * 修改模型服务
     */
    ModifyModelService(req: ModifyModelServiceRequest, cb?: (error: string, rep: ModifyModelServiceResponse) => void): Promise<ModifyModelServiceResponse>;
    /**
     * 删除app
     */
    DeleteAgentApp(req: DeleteAgentAppRequest, cb?: (error: string, rep: DeleteAgentAppResponse) => void): Promise<DeleteAgentAppResponse>;
    /**
     * 创建模型
     */
    CreateModel(req: CreateModelRequest, cb?: (error: string, rep: CreateModelResponse) => void): Promise<CreateModelResponse>;
    /**
     * 查询模型服务列表
     */
    DescribeModelServices(req: DescribeModelServicesRequest, cb?: (error: string, rep: DescribeModelServicesResponse) => void): Promise<DescribeModelServicesResponse>;
    /**
     * 编辑app的model service关联
     */
    ModifyAgentAppModelServices(req: ModifyAgentAppModelServicesRequest, cb?: (error: string, rep: ModifyAgentAppModelServicesResponse) => void): Promise<ModifyAgentAppModelServicesResponse>;
    /**
     * 创建mcp server
     */
    CreateMcpServer(req: CreateMcpServerRequest, cb?: (error: string, rep: CreateMcpServerResponse) => void): Promise<CreateMcpServerResponse>;
    /**
     * 删除模型
     */
    DeleteModel(req: DeleteModelRequest, cb?: (error: string, rep: DeleteModelResponse) => void): Promise<DeleteModelResponse>;
}
