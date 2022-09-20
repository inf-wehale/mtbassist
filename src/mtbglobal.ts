import { runInThisContext } from 'vm';
import * as vscode from 'vscode';
import { MTBInfo } from './mtbinfo';
import { MTBAssistItem } from './mtbitem' ;
import { MTBLaunchConfig } from './mtblaunchdata';

export class MTBAssistCommand implements vscode.Command
{
    public title : string ;
    public command: string ;
    public tooltip: string ;
    public arguments?: any[] ;

    constructor(t: string, c: string, s:string) {
        this.title = t ;
        this.command = c ;
        this.tooltip = s ;
        this.arguments = undefined ;
    }
}

export class MTBAssistGlobalProvider implements vscode.TreeDataProvider<MTBAssistItem> {
    private items_ : MTBAssistItem[] = [] ;
    private onDidChangeTreeData_: vscode.EventEmitter<MTBAssistItem | undefined | null | void> = new vscode.EventEmitter<MTBAssistItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<MTBAssistItem | undefined | null | void> = this.onDidChangeTreeData_.event;

    constructor() {
        this.refresh(undefined) ;
    }

    getTreeItem(element: MTBAssistItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: MTBAssistItem) : Thenable<MTBAssistItem[]> {
        let retval : MTBAssistItem[] = [] ;

        if (!element) {
            retval = this.items_ ;
        }
        else {
            retval = element.getChildren() ;
        }

        return Promise.resolve(retval) ;
    }

    refresh(info?: MTBInfo): void {
        let projmap: Map<string, MTBAssistItem> = new Map<string, MTBAssistItem>() ;
        this.items_ = [] ;

        let item: MTBAssistItem = new MTBAssistItem("Global") ;
        this.items_.push(item) ;

        item = new MTBAssistItem("Create Project") ;
        item.command = new MTBAssistCommand("Create Project", "mtbassist.mtbCreateProject", "Create Project") ;
        this.items_[0].addChild(item) ;

        item = new MTBAssistItem("Import Project") ;
        item.command = new MTBAssistCommand("Import Project", "mtbassist.mtbImportProject", "ImportProject") ;
        this.items_[0].addChild(item) ;

        if (info !== undefined) {      
            item = new MTBAssistItem("Application") ;
            this.items_.push(item) ;

            let projects : string[] = this.findProjects(info!.launch.configs) ;
            projects.forEach((project) => {
                item = new MTBAssistItem("Project: " + project) ;
                projmap.set(project, item) ;
                this.items_.push(item) ;
            }) ;

            info!.launch.configs.forEach((config) => {
                item = new MTBAssistItem(config.displayName) ;
                item.command = new MTBAssistCommand(config.displayName, "mtbassist.mtbRunEditor", "Run the '" + config.displayName + "' program") ;
                item.command.arguments = [] ;
                item.command.arguments.push(config) ;
                item.config = config ;

                if (config.scope === "global") {
                    if (config.shortName !== "project-creator") {
                        this.items_[0].addChild(item) ;
                    }
                } else if (config.scope === "bsp") {
                    this.items_[1].addChild(item) ;
                } else if (config.scope === "project") {
                    projmap.get(config.project)?.addChild(item) ;
                }
            }) ;
        }

        this.onDidChangeTreeData_.fire();
    }

    private findProjects(configs: MTBLaunchConfig[]) : string[] {
        let ret : string[] = [] ;

        configs.forEach(function(config) {
            if (config.scope === "project" && !ret.includes(config.project)) {
                ret.push(config.project) ;
            }
        }) ;

        return ret;
    }
}