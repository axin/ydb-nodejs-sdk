import _ from 'lodash';
import { Ydb } from 'ydb-sdk-proto';
import { typeToValue, convertYdbValueToNative, Types, StringFunction } from './types';
import { warnDeprecation } from './utils';
import IType = Ydb.IType;
import IValue = Ydb.IValue;
import IColumn = Ydb.IColumn;
import ITypedValue = Ydb.ITypedValue;
import IResultSet = Ydb.IResultSet;

export const typeMetadataKey = Symbol('type');

export function declareType(type: IType) {
    if (type === Types.STRING) {
        warnDeprecation(
            'Types.STRING type is deprecated and will be removed in the next major release. Please migrate ' +
            'to the newer type Types.BYTES which avoids implicit conversions between Buffer and string types.'
        );
    }

    return Reflect.metadata(typeMetadataKey, type);
}

export function withTypeOptions(options: TypedDataOptions) {
    return function <T extends Function>(constructor: T): T & { __options: TypedDataOptions } {
        return _.merge(constructor, { __options: options });
    }
}

export interface NamesConversion {
    ydbToJs: StringFunction;
    jsToYdb: StringFunction;
}

export interface TypedDataOptions {
    namesConversion?: NamesConversion;
}

export function getNameConverter(options: TypedDataOptions, direction: keyof NamesConversion): StringFunction {
    return (options.namesConversion || identityConversion)[direction];
}

export const snakeToCamelCaseConversion: NamesConversion = {
    jsToYdb: _.snakeCase,
    ydbToJs: _.camelCase,
};

export const identityConversion: NamesConversion = {
    jsToYdb: _.identity,
    ydbToJs: _.identity,
}

export class TypedData {
    [property: string]: any;
    static __options: TypedDataOptions = {};

    constructor(data: Record<string, any>) {
        _.assign(this, data);
    }

    getType(propertyKey: string): IType {
        const typeMeta = Reflect.getMetadata(typeMetadataKey, this, propertyKey);
        if (!typeMeta) {
            throw new Error(`Property ${propertyKey} should be decorated with @declareType!`);
        }
        return typeMeta;
    }

    getValue(propertyKey: string): IValue {
        const type = this.getType(propertyKey);
        return typeToValue(type, this[propertyKey]);
    }

    getTypedValue(propertyKey: string): ITypedValue {
        return {
            type: this.getType(propertyKey),
            value: this.getValue(propertyKey)
        };
    }

    get typedProperties(): string[] {
        return _.filter(Reflect.ownKeys(this), (key) => (
            typeof key === 'string' && Reflect.hasMetadata(typeMetadataKey, this, key)
        )) as string[];
    }

    getRowType() {
        const cls = this.constructor as typeof TypedData;
        const converter = getNameConverter(cls.__options, 'jsToYdb');
        return {
            structType: {
                members: _.map(this.typedProperties, (propertyKey) => ({
                    name: converter(propertyKey),
                    type: this.getType(propertyKey)
                }))
            }
        };
    }

    getRowValue() {
        return {
            items: _.map(this.typedProperties, (propertyKey: string) => {
                return this.getValue(propertyKey);
            })
        };
    }

    static createNativeObjects(resultSet: IResultSet): TypedData[] {
        const { rows, columns } = resultSet;
        if (!columns) {
            return [];
        }
        const converter = getNameConverter(this.__options, 'ydbToJs');
        return _.map(rows, (row) => {
            const obj = _.reduce(row.items, (acc: Record<string, any>, value, index) => {
                const column = columns[index] as IColumn;
                if (column.name && column.type) {
                    acc[converter(column.name)] = convertYdbValueToNative(column.type, value);
                }
                return acc;
            }, {});
            return new this(obj);
        });
    }

    static asTypedCollection(collection: TypedData[]): ITypedValue {
        return {
            type: {
                listType: {
                    item: collection[0].getRowType()
                }
            },
            value: {
                items: collection.map((item) => item.getRowValue())
            }
        };
    }
}
