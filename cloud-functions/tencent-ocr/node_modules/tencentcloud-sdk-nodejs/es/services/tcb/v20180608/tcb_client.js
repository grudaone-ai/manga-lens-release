import { AbstractClient } from "../../../common/abstract_client";
export class Client extends AbstractClient {
    constructor(clientConfig) {
        super("tcb.tencentcloudapi.com", "2018-06-08", clientConfig);
    }
    async DescribeCreateMySQLResult(req, cb) {
        return this.request("DescribeCreateMySQLResult", req, cb);
    }
    async DescribeGatewayVersions(req, cb) {
        return this.request("DescribeGatewayVersions", req, cb);
    }
    async CreateCustomLoginKey(req, cb) {
        return this.request("CreateCustomLoginKey", req, cb);
    }
    async DescribeUserList(req, cb) {
        return this.request("DescribeUserList", req, cb);
    }
    async DescribeVmSpec(req, cb) {
        return this.request("DescribeVmSpec", req, cb);
    }
    async CreateHostingDomain(req, cb) {
        return this.request("CreateHostingDomain", req, cb);
    }
    async DescribeEnvAccountCircle(req, cb) {
        return this.request("DescribeEnvAccountCircle", req, cb);
    }
    async CreateMySQL(req, cb) {
        return this.request("CreateMySQL", req, cb);
    }
    async UpdateTable(req, cb) {
        return this.request("UpdateTable", req, cb);
    }
    async DescribeApiKeyList(req, cb) {
        return this.request("DescribeApiKeyList", req, cb);
    }
    async DeleteVmInstance(req, cb) {
        return this.request("DeleteVmInstance", req, cb);
    }
    async CreateEnvResource(req, cb) {
        return this.request("CreateEnvResource", req, cb);
    }
    async CreateEnv(req, cb) {
        return this.request("CreateEnv", req, cb);
    }
    async ModifyDatabaseACL(req, cb) {
        return this.request("ModifyDatabaseACL", req, cb);
    }
    async CreateVmInstance(req, cb) {
        return this.request("CreateVmInstance", req, cb);
    }
    async DeleteHTTPServiceRoute(req, cb) {
        return this.request("DeleteHTTPServiceRoute", req, cb);
    }
    async DescribeHTTPServiceRoute(req, cb) {
        return this.request("DescribeHTTPServiceRoute", req, cb);
    }
    async ModifyClsTopic(req, cb) {
        return this.request("ModifyClsTopic", req, cb);
    }
    async CreateAuthDomain(req, cb) {
        return this.request("CreateAuthDomain", req, cb);
    }
    async DescribeVmInstances(req, cb) {
        return this.request("DescribeVmInstances", req, cb);
    }
    async InquireVmPrice(req, cb) {
        return this.request("InquireVmPrice", req, cb);
    }
    async DescribeCloudBaseRunServerVersion(req, cb) {
        return this.request("DescribeCloudBaseRunServerVersion", req, cb);
    }
    async DescribeAuthDomains(req, cb) {
        return this.request("DescribeAuthDomains", req, cb);
    }
    async DescribeClient(req, cb) {
        return this.request("DescribeClient", req, cb);
    }
    async ModifySafeRule(req, cb) {
        return this.request("ModifySafeRule", req, cb);
    }
    async DeleteAuthDomain(req, cb) {
        return this.request("DeleteAuthDomain", req, cb);
    }
    async DescribeMySQLClusterDetail(req, cb) {
        return this.request("DescribeMySQLClusterDetail", req, cb);
    }
    async DescribeBaasPackageList(req, cb) {
        return this.request("DescribeBaasPackageList", req, cb);
    }
    async ModifyClient(req, cb) {
        return this.request("ModifyClient", req, cb);
    }
    async ModifyHTTPServiceRoute(req, cb) {
        return this.request("ModifyHTTPServiceRoute", req, cb);
    }
    async DescribeHostingDomainTask(req, cb) {
        return this.request("DescribeHostingDomainTask", req, cb);
    }
    async RenewEnv(req, cb) {
        return this.request("RenewEnv", req, cb);
    }
    async DescribeDatabaseACL(req, cb) {
        return this.request("DescribeDatabaseACL", req, cb);
    }
    async DeleteUsers(req, cb) {
        return this.request("DeleteUsers", req, cb);
    }
    async DescribeStaticStore(req, cb) {
        return this.request("DescribeStaticStore", req, cb);
    }
    async DescribeTable(req, cb) {
        return this.request("DescribeTable", req, cb);
    }
    async ModifyEnv(req, cb) {
        return this.request("ModifyEnv", req, cb);
    }
    async DeleteProvider(req, cb) {
        return this.request("DeleteProvider", req, cb);
    }
    async ExecutePGSql(req, cb) {
        return this.request("ExecutePGSql", req, cb);
    }
    async CheckTcbService(req, cb) {
        return this.request("CheckTcbService", req, cb);
    }
    async CreateApiKey(req, cb) {
        return this.request("CreateApiKey", req, cb);
    }
    async DescribeSafeRule(req, cb) {
        return this.request("DescribeSafeRule", req, cb);
    }
    async ModifyEnvPlan(req, cb) {
        return this.request("ModifyEnvPlan", req, cb);
    }
    async DescribeMySQLTaskStatus(req, cb) {
        return this.request("DescribeMySQLTaskStatus", req, cb);
    }
    async SearchClsLog(req, cb) {
        return this.request("SearchClsLog", req, cb);
    }
    async DescribeQuotaData(req, cb) {
        return this.request("DescribeQuotaData", req, cb);
    }
    async ModifyProvider(req, cb) {
        return this.request("ModifyProvider", req, cb);
    }
    async DestroyEnv(req, cb) {
        return this.request("DestroyEnv", req, cb);
    }
    async ModifyUser(req, cb) {
        return this.request("ModifyUser", req, cb);
    }
    async GetProviders(req, cb) {
        return this.request("GetProviders", req, cb);
    }
    async DescribeLoginConfig(req, cb) {
        return this.request("DescribeLoginConfig", req, cb);
    }
    async DeleteTable(req, cb) {
        return this.request("DeleteTable", req, cb);
    }
    async DescribeBillingInfo(req, cb) {
        return this.request("DescribeBillingInfo", req, cb);
    }
    async DescribeCloudBaseBuildService(req, cb) {
        return this.request("DescribeCloudBaseBuildService", req, cb);
    }
    async DescribeEnvs(req, cb) {
        return this.request("DescribeEnvs", req, cb);
    }
    async DestroyMySQL(req, cb) {
        return this.request("DestroyMySQL", req, cb);
    }
    async ModifyLoginConfig(req, cb) {
        return this.request("ModifyLoginConfig", req, cb);
    }
    async RunCommands(req, cb) {
        return this.request("RunCommands", req, cb);
    }
    async CreateBillDeal(req, cb) {
        return this.request("CreateBillDeal", req, cb);
    }
    async DescribeCurveData(req, cb) {
        return this.request("DescribeCurveData", req, cb);
    }
    async CreateHTTPServiceRoute(req, cb) {
        return this.request("CreateHTTPServiceRoute", req, cb);
    }
    async CreateTable(req, cb) {
        return this.request("CreateTable", req, cb);
    }
    async CreateUser(req, cb) {
        return this.request("CreateUser", req, cb);
    }
    async CreateStaticStore(req, cb) {
        return this.request("CreateStaticStore", req, cb);
    }
    async DescribeEnvLimit(req, cb) {
        return this.request("DescribeEnvLimit", req, cb);
    }
    async RunSql(req, cb) {
        return this.request("RunSql", req, cb);
    }
    async DestroyStaticStore(req, cb) {
        return this.request("DestroyStaticStore", req, cb);
    }
    async DeleteApiKey(req, cb) {
        return this.request("DeleteApiKey", req, cb);
    }
    async AddProvider(req, cb) {
        return this.request("AddProvider", req, cb);
    }
    async DescribeTables(req, cb) {
        return this.request("DescribeTables", req, cb);
    }
    async ListTables(req, cb) {
        return this.request("ListTables", req, cb);
    }
}
