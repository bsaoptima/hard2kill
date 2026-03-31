import { BaseEntity } from '../entities/BaseEntity';
import { Container } from 'pixi.js';

export class BaseManager<T extends BaseEntity> extends Container {
    protected container: Container;

    protected entities: { [key: string]: T };

    private cachedEntities: T[] = [];

    private cacheInvalid: boolean = true;

    constructor(name: string) {
        super();
        this.container = new Container();
        this.container.name = name;
        this.entities = {};
    }

    // Container
    public show = () => {
        this.visible = true;
    };

    public hide = () => {
        this.visible = false;
    };

    // Entities
    public add = (key: string, entity: T) => {
        this.entities[key] = entity;
        this.addChild(entity.container);
        this.cacheInvalid = true;
    };

    public get = (key: string): T | undefined => {
        return this.entities[key];
    };

    public getAll = (): T[] => {
        if (this.cacheInvalid) {
            this.cachedEntities = Object.values(this.entities);
            this.cacheInvalid = false;
        }
        return this.cachedEntities;
    };

    public remove = (key: string) => {
        this.removeChild(this.entities[key].container);
        delete this.entities[key];
        this.cacheInvalid = true;
    };
}
