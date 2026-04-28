import { AbstractClient } from "../../../common/abstract_client";
import { ClientConfig } from "../../../common/interface";
import { IsolateDBInstanceRequest, DescribeFlowRequest, ModifyDBSBackupSetCommentResponse, ModifyInstanceNameResponse, ModifyDBInstanceSecurityGroupsResponse, DescribeDBParametersRequest, DescribeDBSArchiveLogsResponse, DescribeDatabaseObjectsResponse, CreateDBSBackupResponse, CreateDBSBackupRequest, DestroyInstancesRequest, DescribeDBSecurityGroupsRequest, ModifyDBParametersResponse, ModifyInstanceNameRequest, ModifyAutoRenewFlagRequest, ModifyDBSBackupPolicyResponse, DescribeDBSCloneInstancesResponse, DescribeDBSecurityGroupsResponse, DescribeDBSArchiveLogsRequest, ModifyDBSBackupPolicyRequest, DescribeDBSCloneInstancesRequest, DescribeDatabaseObjectsRequest, DescribeDBSAvailableRecoveryTimeResponse, ModifyAutoRenewFlagResponse, DestroyInstancesResponse, DescribeDBParametersResponse, IsolateDBInstanceResponse, DescribeDBSAvailableRecoveryTimeRequest, DeleteDBSBackupSetsResponse, DescribeFlowResponse, CancelIsolateDBInstancesResponse, CancelIsolateDBInstancesRequest, ModifyDBSBackupSetCommentRequest, ModifyDBParametersRequest, ModifyDBInstanceSecurityGroupsRequest, DeleteDBSBackupSetsRequest } from "./tdmysql_models";
/**
 * tdmysql client
 * @class
 */
export declare class Client extends AbstractClient {
    constructor(clientConfig: ClientConfig);
    /**
     * 本接口（DescribeDatabaseObjects）用于查询云数据库实例的数据库中的对象列表，包含表、存储过程、视图和函数。
     */
    DescribeDatabaseObjects(req: DescribeDatabaseObjectsRequest, cb?: (error: string, rep: DescribeDatabaseObjectsResponse) => void): Promise<DescribeDatabaseObjectsResponse>;
    /**
     * 本接口（DescribeDBParameters）用于获取实例的当前参数设置。
     */
    DescribeDBParameters(req: DescribeDBParametersRequest, cb?: (error: string, rep: DescribeDBParametersResponse) => void): Promise<DescribeDBParametersResponse>;
    /**
     * 本接口（DescribeDBSecurityGroups）用于查询实例安全组信息
     */
    DescribeDBSecurityGroups(req: DescribeDBSecurityGroupsRequest, cb?: (error: string, rep: DescribeDBSecurityGroupsResponse) => void): Promise<DescribeDBSecurityGroupsResponse>;
    /**
     * 本接口（CancelIsolateDBInstances）提供批量解除隔离实例功能
     */
    CancelIsolateDBInstances(req: CancelIsolateDBInstancesRequest, cb?: (error: string, rep: CancelIsolateDBInstancesResponse) => void): Promise<CancelIsolateDBInstancesResponse>;
    /**
     * 获取可恢复时间 DescribeDBSAvailableRecoveryTime
     */
    DescribeDBSAvailableRecoveryTime(req: DescribeDBSAvailableRecoveryTimeRequest, cb?: (error: string, rep: DescribeDBSAvailableRecoveryTimeResponse) => void): Promise<DescribeDBSAvailableRecoveryTimeResponse>;
    /**
     * 修改实例备份策略 ModifyDBSBackupPolicy
     */
    ModifyDBSBackupPolicy(req: ModifyDBSBackupPolicyRequest, cb?: (error: string, rep: ModifyDBSBackupPolicyResponse) => void): Promise<ModifyDBSBackupPolicyResponse>;
    /**
     * 修改实例备份备注 ModifyDBSBackupSetComment
     */
    ModifyDBSBackupSetComment(req: ModifyDBSBackupSetCommentRequest, cb?: (error: string, rep: ModifyDBSBackupSetCommentResponse) => void): Promise<ModifyDBSBackupSetCommentResponse>;
    /**
     * 删除实例手工备份 DeleteDBSBackupSets
     */
    DeleteDBSBackupSets(req: DeleteDBSBackupSetsRequest, cb?: (error: string, rep: DeleteDBSBackupSetsResponse) => void): Promise<DeleteDBSBackupSetsResponse>;
    /**
     * 查询实例归档日志列表 DescribeDBSArchiveLogs
     */
    DescribeDBSArchiveLogs(req: DescribeDBSArchiveLogsRequest, cb?: (error: string, rep: DescribeDBSArchiveLogsResponse) => void): Promise<DescribeDBSArchiveLogsResponse>;
    /**
     * 本接口（DestroyInstances）提供批量销毁实例功能
     */
    DestroyInstances(req: DestroyInstancesRequest, cb?: (error: string, rep: DestroyInstancesResponse) => void): Promise<DestroyInstancesResponse>;
    /**
     * 本接口（ModifyAutoRenewFlag）用于修改自动续费标志
     */
    ModifyAutoRenewFlag(req: ModifyAutoRenewFlagRequest, cb?: (error: string, rep: ModifyAutoRenewFlagResponse) => void): Promise<ModifyAutoRenewFlagResponse>;
    /**
     * 创建实例手工备份  CreateDBSBackup
     */
    CreateDBSBackup(req: CreateDBSBackupRequest, cb?: (error: string, rep: CreateDBSBackupResponse) => void): Promise<CreateDBSBackupResponse>;
    /**
     * 本接口（ModifyInstanceName）提供修改实例名称功能
     */
    ModifyInstanceName(req: ModifyInstanceNameRequest, cb?: (error: string, rep: ModifyInstanceNameResponse) => void): Promise<ModifyInstanceNameResponse>;
    /**
     * 本接口（ModifyDBParameters）用于修改实例参数。
     */
    ModifyDBParameters(req: ModifyDBParametersRequest, cb?: (error: string, rep: ModifyDBParametersResponse) => void): Promise<ModifyDBParametersResponse>;
    /**
     * 查询实例克隆列表 DescribeDBSCloneInstances
     */
    DescribeDBSCloneInstances(req: DescribeDBSCloneInstancesRequest, cb?: (error: string, rep: DescribeDBSCloneInstancesResponse) => void): Promise<DescribeDBSCloneInstancesResponse>;
    /**
     * 本接口（IsolateDBInstance）提供批量隔离实例功能
     */
    IsolateDBInstance(req: IsolateDBInstanceRequest, cb?: (error: string, rep: IsolateDBInstanceResponse) => void): Promise<IsolateDBInstanceResponse>;
    /**
     * 本接口（ModifyDBInstanceSecurityGroups）用于修改云数据库安全组
     */
    ModifyDBInstanceSecurityGroups(req: ModifyDBInstanceSecurityGroupsRequest, cb?: (error: string, rep: ModifyDBInstanceSecurityGroupsResponse) => void): Promise<ModifyDBInstanceSecurityGroupsResponse>;
    /**
     * 本接口（DescribeFlow）用于查询异步任务流程状态
     */
    DescribeFlow(req?: DescribeFlowRequest, cb?: (error: string, rep: DescribeFlowResponse) => void): Promise<DescribeFlowResponse>;
}
