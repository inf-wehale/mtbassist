///
// Copyright 2022 by C And T Software
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 	http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//

import * as path from 'path' ;
import * as os from 'os' ;

import { ModusToolboxEnvVarNames } from "./mtbnames";
import { AppType, MTBAppInfo } from "./mtbappinfo";
import { MTBAssetInstance } from "./mtbassets";
import { getMTBAssetProvider } from "../mtbassetprovider";
import { runMakeGetAppInfo } from './mtbrunprogs';
import { MessageType, MTBExtensionInfo } from '../mtbextinfo';

export class MTBProjectInfo
{
    // The app that owns this project
    public app : MTBAppInfo ;

    // The directory containining the project
    public name: string ;
        
    // The shared directory
    public sharedDir?: string ;

    // The libs directory
    public libsDir?: string ;

    // The deps directory
    public depsDir?: string ;

    // The global directory
    public globalDir?: string ;

    // The list of assets
    public assets: MTBAssetInstance[] ;

    // The list of vars from the make get_app_info
    mtbvars: Map<string, string> = new Map<string, string>() ;

    constructor(app: MTBAppInfo, name: string) {
        this.app = app ;
        this.name = name ;
        this.assets = [] ;
    }

    public getVar(varname: string) : string | undefined {
        return this.mtbvars.get(varname) ;
    }

    public updateAssets() {
        getMTBAssetProvider().refresh(this.name, this.assets) ;
    }

    public initProject() : Promise<void> {
        return new Promise<void>((resolve, reject) => {
            runMakeGetAppInfo(this.getProjectDir())
                .then((data: Map<string, string>) => {
                    this.initProjectFromData(data)
                        .then((ret: boolean) => {
                            if (ret) {
                                resolve() ;
                            }
                            else {
                                reject(new Error("cannot initialize project '" + this.name + "'")) ;
                            }
                        })
                        .catch((err: Error) => {
                            reject(err) ;
                        }) ;
                })
                .catch((err : Error) => {
                    reject(err) ;
                }) ;
        }) ;
    }

    public initProjectFromData(data: Map<string, string>) : Promise<boolean> {
        let ret: Promise<boolean> = new Promise<boolean>((resolve, reject) => {

            if (data.has(ModusToolboxEnvVarNames.MTB_LIBS)) {
                this.libsDir = data.get(ModusToolboxEnvVarNames.MTB_LIBS)
            }
            else {
                let msg: string = "project '" + this.name + "' is missing value '" + ModusToolboxEnvVarNames.MTB_LIBS  + "'" ;
                MTBExtensionInfo.getMtbExtensionInfo().logMessage(MessageType.error, msg) ;
                reject(false);
            }

            if (data.has(ModusToolboxEnvVarNames.MTB_GLOBAL_DIR)) {
                this.globalDir = data.get(ModusToolboxEnvVarNames.MTB_GLOBAL_DIR);
            }
            else {
                this.globalDir = path.join(path.join(os.homedir(), ".modustoolbox"), "global") ;
            }

            if (data.has(ModusToolboxEnvVarNames.MTB_DEPS)) {
                this.depsDir = data.get(ModusToolboxEnvVarNames.MTB_DEPS);
            }
            else {
                let msg: string = "project '" + this.name + "' is missing value '" + ModusToolboxEnvVarNames.MTB_DEPS + "'" ;
                MTBExtensionInfo.getMtbExtensionInfo().logMessage(MessageType.error, msg) ;
                reject(false);
            }

            if (data.has(ModusToolboxEnvVarNames.MTB_WKS_SHARED_DIR) && data.has(ModusToolboxEnvVarNames.MTB_WKS_SHARED_NAME)) {
                let shdir: string = data.get(ModusToolboxEnvVarNames.MTB_WKS_SHARED_DIR) as string ;
                let shname: string = data.get(ModusToolboxEnvVarNames.MTB_WKS_SHARED_NAME) as string ;
                this.sharedDir = path.join(shdir, shname) ;
            }
            else {
                let msg: string = "project '" + this.name + "' is missing value '" + ModusToolboxEnvVarNames.MTB_WKS_SHARED_DIR + "'";
                msg += " or value '" + ModusToolboxEnvVarNames.MTB_WKS_SHARED_NAME + "'" ;
                MTBExtensionInfo.getMtbExtensionInfo().logMessage(MessageType.error, msg) ;  
                reject(false);          
            }
            this.mtbvars = data ;

            MTBAssetInstance.mtbLoadAssetInstance(this)
                .then(() => {
                    resolve(true) ;
                })
                .catch((err: Error) => {
                    reject(err) ;
                }) ;
        }) ;

        return ret ;
    }

    public getProjectDir() : string {
        let ret : string = this.app.appDir ;
        if (this.app.appType === AppType.multicore) {
            ret = path.join(this.app.appDir, this.name) ;
        }

        return ret ;
    }
}
