///
// Copyright 2022 by Apollo Software
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

//
// This file loads the and maintains the information about the current ModusToolbox
// application.
//
// A new application is loaded by calling mtbAssistLoadApp(appDir) where appDir is
// the directory that contains the ModusToolbox application.  Once this API is called
// the application can be accessed via the global theModusToolboxApp.  The load happens
// in the background and the load may fail, so it is important to check the isLoading
// member to see if the loading processes is underway.  If the load fails or has never
// happened, the isValid member will be false.
//
import * as path from 'path' ;
import * as fs from 'fs' ;
import * as open from 'open' ;

import { theModusToolboxApp } from "./mtbappinfo";
import { MessageType, MTBExtensionInfo } from './mtbextinfo';
import { getMTBAssetProvider } from './mtbassetprovider';
import { platform } from 'os';
import { env } from 'process';

export class MTBAssetInstance
{
    static readonly mtbAssetName: string = "$$ASSET_REPO$$" ;
    static readonly mtbLocalName: string = "$$LOCAL$$" ;

    public url?: string ;
    public version?: string ;
    public location?: string ;
    public name?: string ;
    public isValid: boolean ;

    constructor() {
        this.url = undefined ;
        this.version = undefined ;
        this.location = undefined ;
        this.name = undefined ;
        this.isValid = false ;
    }

    static mtbPathToInstance(path: string) : MTBAssetInstance | undefined {
        let ret : MTBAssetInstance | undefined ;
        if (theModusToolboxApp?.assets) {
            for(let asset of theModusToolboxApp.assets) {
                if (asset.isValid) {
                    if (path.startsWith(asset.location as string)) {
                        ret = asset ;
                    }
                }
            }
        }
        return ret ;
    }

    static processMTBContents(line: string) : MTBAssetInstance {
        let ret : MTBAssetInstance = new MTBAssetInstance() ;

        let parts: string[] = line.split('#') ;
        if (parts.length === 3) {
            ret.url = parts[0] ;
            ret.version = parts[1] ;
            let loc: string = parts[2].trim() ;

            let index: number = parts[0].lastIndexOf('/') ;
            if (index !== -1) {

                ret.name = parts[0].substring(index + 1) ;

                if (loc.startsWith(this.mtbAssetName))  {
                    ret.location = path.join(theModusToolboxApp!.sharedDir!, loc.substring(this.mtbAssetName.length));
                }
                else if (loc.startsWith(this.mtbLocalName)) {
                    ret.location = path.join(theModusToolboxApp!.libsDir!, loc.substring(this.mtbLocalName.length));
                }
                else {
                    ret.location = path.join(theModusToolboxApp!.appDir, loc) ;
                }

                ret.location = path.normalize(ret.location) ;

                ret.isValid = true ;
            }
        }

        return ret;
    }

    static readMtbFile(filename: string) : Promise<MTBAssetInstance> {
        let ret = new Promise<MTBAssetInstance>((resolve, reject) => {
            let extinfo: MTBExtensionInfo = MTBExtensionInfo.getMtbExtensionInfo() ;
            extinfo.logMessage(MessageType.debug, "reading MTB file '" + filename + "'") ;

            fs.readFile(filename, (err, buf) => {
                if (err) {
                    let errmgs = err as Error ;
                    let extinfo: MTBExtensionInfo = MTBExtensionInfo.getMtbExtensionInfo() ;
                    extinfo.logMessage(MessageType.error, "error reading mtb file '" + filename + "' - " + errmgs.message) ;
                    reject(err) ;
                }
                else {
                    let ret = this.processMTBContents(buf.toString()) ;
                    resolve(ret) ;
                }
            }) ;
        }) ;

        return ret ;
    }

    static scanOneDir(dirname: string) {
        fs.readdir(dirname, (err, files) => {
            if (err) {
                let errmgs = err as Error ;
                let extinfo: MTBExtensionInfo = MTBExtensionInfo.getMtbExtensionInfo() ;
                extinfo.logMessage(MessageType.error, "error scanning directory '" + dirname + "' - " + errmgs.message) ;
            }
            else {
                files.forEach((file) => {
                    if (path.extname(file) === '.mtb') {
                        this.readMtbFile(path.join(dirname, file))
                            .then((asset) => {
                                theModusToolboxApp!.assets.push(asset) ;
                                getMTBAssetProvider().refresh(theModusToolboxApp!.assets) ;
                            })
                            .catch((err) => {

                            }) ;
                    }
                }) ;
            }
        }) ;
    }

    public static mtbLoadAssetInstance() {
        if (theModusToolboxApp?.libsDir) {
            this.scanOneDir(theModusToolboxApp.libsDir) ;
        }

        if (theModusToolboxApp?.depsDir) {
            this.scanOneDir(theModusToolboxApp.depsDir) ;
        }
    }

    pathMatch(p: string) : boolean {
        let ret: boolean = false ;

        if (this.location) {
            if (process.platform === 'win32') 
            {
                if (path.isAbsolute(p) && path.isAbsolute(this.location))
                {
                    if (p.length > 2 && this.location.length > 2) {
                        if (p.at(0)!.toLowerCase() === this.location.at(0)!.toLowerCase() && p.at(1)! === ':' && this.location.at(1)! === ':')
                        {
                            ret = p.substring(2).startsWith(this.location.substring(2)) ;
                        }
                    }
                }
                else
                {
                    ret = p.startsWith(this.location) ;
                }
            }
            else
            {
                ret = p.startsWith(this.location) ;
            }
        }

        return ret ;
    }

    public displayDocs() {
        if (theModusToolboxApp?.launch) {
            theModusToolboxApp.launch.docs.forEach(doc => {
                if (this.pathMatch(doc.location)) {
                    open(decodeURIComponent(doc.location)) ;
                }
            }) ;
        }
    }
}