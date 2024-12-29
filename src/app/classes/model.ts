/**
 * data structure to model guidelines that evaluate the risk/severity of specific cancers
 * 
 * created by Johannes Zink,
 * 2021/10/06
 * 
 * version copied from other project
 * 2024/07/15
 */

//the following import is using jackson-js for (better) serialization
import {
    JsonProperty, JsonClassType, JsonIdentityInfo, JsonTypeInfoId, JsonTypeInfoAs, JsonSubTypes,
    JsonTypeInfo, ObjectIdGenerator, JsonTypeName, JsonIgnoreProperties, JsonPropertyOrder
} from 'jackson-js';
import { Constants } from './constants';


export abstract class Named {
    @JsonProperty() @JsonClassType({ type: () => [String] })
    name: string;
    @JsonProperty() @JsonClassType({ type: () => [ConditionalString] })
    description: ConditionalString;

    constructor(name: string, description: string | ConditionalString) {
        this.name = name;
        this.description = (typeof description === 'string') ? new ConditionalString(description) : description;
    }

    setDescriptionAsString(description: string) {
        this.description = new ConditionalString(description);
    }

    getDescription(values?: CriteriaValues): string {
        return this.description.constructString(values);
    }

    /**
     * Removes html content that may be contained in the string description and transforms it to plain text
     */
    getPlainDescription(values?: CriteriaValues): string {
        var tmp = document.createElement('DIV');
        tmp.innerHTML = this.getDescription(values);
        return tmp.textContent || tmp.innerText || '';
        // return this.description.replace(/<[^>]+>/g, '');
    }
}

export class ConditionalString {
    @JsonProperty() @JsonClassType({ type: () => [Condition] })
    public condition?: Condition;
    @JsonProperty() @JsonClassType({ type: () => [String] })
    public text?: string;
    @JsonProperty() @JsonClassType({ type: () => [Array, [ConditionalString]] })
    public subConditionalStrings: ConditionalString[] = [];

    static SEPARATING_SYMBOL: string = " ";

    constructor(content: string | ConditionalString[], condition?: Condition) {
        this.condition = condition;
        if (typeof content === 'string') {
            this.text = content;
        }
        else {
            this.subConditionalStrings = content;
        }
    }

    constructString(values?: CriteriaValues): string {
        if (values == undefined) {
            values = new CriteriaValues;
        }
        if (this.condition != undefined && this.condition.evaluate(values) != BooleanOrUndef.TRUE) {
            //condition is not fulfilled -> return empty string
            return "";
        }
        //otherwise we return the object that is saved here:
        // either a string
        if (this.text != undefined) {
            return this.text;
        }
        // or a collection of subConditionalStrings that need to be evaluated recursively
        var returnString = "";
        var prevChildText = "";
        for (let child of this.subConditionalStrings) {
            if (prevChildText != "") {
                returnString += ConditionalString.SEPARATING_SYMBOL;
            }
            prevChildText = child.constructString(values);
            returnString += prevChildText;
        }
        return returnString;
    }
}

export class Range {
    @JsonProperty() @JsonClassType({ type: () => [Number] })
    public start: number;
    @JsonProperty() @JsonClassType({ type: () => [Number] })
    public end: number;
    @JsonProperty() @JsonClassType({ type: () => [Boolean] })
    public integral = false;

    constructor(start: number, end: number, isIntegral?: boolean) {
        this.start = start;
        this.end = end;
        if (isIntegral != undefined) {
            this.integral = isIntegral;
        }
    }

    public getMean(): number {
        const mean = (this.start + this.end) / 2.0;
        return this.integral ? Math.round(mean) : mean;
    }

    public toString(): string {
        if (this.start == undefined || this.end == undefined || Number.isNaN(this.start) || Number.isNaN(this.end)) {
            return "NaN";
        }
        return this.start + "–" + this.end;
    }

    public clone(): Range {
        return new Range(this.start, this.end, this.integral);
    }

    public equals(otherRange: any): boolean {
        if (otherRange instanceof Range && otherRange.start === this.start && otherRange.end === this.end && otherRange.integral === this.integral) {
            return true;
        }
        return false;
    }
}

/**
* should be used as a abstract class/interface
* (is not abstract to facilitate (de)serialization)
*/
@JsonTypeInfo({ use: JsonTypeInfoId.NAME, include: JsonTypeInfoAs.PROPERTY, property: "@type" })
@JsonSubTypes({
    types: [
        { class: () => NumericalFunction, name: 'func' },
        { class: () => Constant, name: 'constant' },
        { class: () => CriterionValue, name: 'criterion' },
        { class: () => StateValue, name: 'state' },
        { class: () => StateGroupValue, name: 'stategroup' },
        { class: () => ConditionalNumerical, name: 'conditional' },
    ]
})
export class Numerical {
    getValue(values: CriteriaValues): number | Range | undefined {
        return undefined;
    }

    getValueLow(values?: CriteriaValues): number | undefined {
        const value = this.getValue(values ?? new CriteriaValues());
        return value instanceof Range ? value.start : value;
    }

    getValueMean(values?: CriteriaValues): number | undefined {
        const value = this.getValue(values ?? new CriteriaValues());
        return value instanceof Range ? value.getMean() : value;
    }

    getValueHigh(values?: CriteriaValues): number | undefined {
        const value = this.getValue(values ?? new CriteriaValues());
        return value instanceof Range ? value.end : value;
    }

    /**
     * 
     * @param decimalPrecision 
     *      number of digits behind the decimal separator (excluding leading 0s)
     */
    getRoundedValue(values: CriteriaValues, decimalPrecision: number) {
        var value = this.getValue(values);
        if (value == undefined) {
            return undefined;
        }
        else if (value instanceof Range) {
            return new Range(Numerical.round(value.start, decimalPrecision), Numerical.round(value.end, decimalPrecision));
        }
        return Numerical.round(value, decimalPrecision);
    }

    getDependingCriteria(values: CriteriaValues): Criterion[] {
        return [];
    }

    /**
     * 
     * @param values 
     *      current criteria values
     * @param onlyMinOrMax 
     *      false: only min; true: only max; undefined: all;
     * @returns 
     *      html string describing the reason(s), typically the conditions, why this numerical has this value for these criteria values.
     */
    conditionAsColorCodedHtml(values: CriteriaValues, onlyMinOrMax?: boolean): string {
        return "-- keiner --";
    }

    toString(): string {
        return "?";
    }

    public static round(value: number, decimalPrecision: number) {
        //add leading 0s
        let leadingZeros = 0;
        while (value != 0 && -1 < value && value < 1) {
            value *= 10;
            ++leadingZeros;
        }
        if (leadingZeros > 0) --decimalPrecision;
        //round to precision
        return Math.round(value * 10 ** decimalPrecision) / (10 ** (leadingZeros + decimalPrecision));
    }
}

/**
* Extension of the traditional boolean variables -- we have a thrid state which is undefined
*/
export enum BooleanOrUndef {
    FALSE = "FALSE",
    TRUE = "TRUE",
    UNDEFINED = "UNDEFINED"
}

export enum Visibility {
    ALWAYS = "ALWAYS",
    IF_RELEVANT = "IF_RELEVANT",
    IF_RELEVANT_FOR_MAIN_GROUP = "IF_RELEVANT_FOR_MAIN_GROUP",
    IF_CONFIRMED = "IF_CONFIRMED",
    NEVER = "NEVER"
}

class VisibilityUtils {
    public static toString(visibility: Visibility): string {
        switch (visibility) {
            case Visibility.ALWAYS: return "immer";
            case Visibility.IF_RELEVANT: return "wenn relevant";
            case Visibility.IF_RELEVANT_FOR_MAIN_GROUP: return "wenn relevant für Hauptzustandsgruppe";
            case Visibility.IF_CONFIRMED: return "wenn bestätigt";
            case Visibility.NEVER: return "nie";
        }
        return "";
    }
}

@JsonIgnoreProperties({ value: ['containingStates', 'valueNames'] })
@JsonTypeInfo({ use: JsonTypeInfoId.NAME, include: JsonTypeInfoAs.PROPERTY, property: "@type" })
@JsonSubTypes({
    types: [
        { class: () => NumericalCriterion, name: 'numerical' },
        { class: () => CategoricalCriterion, name: 'categorical' },
    ]
})
export abstract class Criterion extends Named implements Referencable {
    @JsonProperty() @JsonClassType({ type: () => [String] })
    shortDescription: string;
    @JsonProperty() @JsonClassType({ type: () => [String] })
    visibility: Visibility;
    @JsonProperty() @JsonClassType({ type: () => [String] })
    regexRule?: string;
    @JsonProperty() @JsonClassType({ type: () => [String] })
    referenceID?: string;

    //is set by the program during runtime to link the states it is contained in
    public containingStates: StateWithGroup[] = [];

    constructor(name: string, description: string | ConditionalString, visibility: Visibility, shortDescription?: string, regexRule?: string, referenceID?: string) {
        super(name, description);
        this.shortDescription = shortDescription ?? "";
        this.visibility = visibility;
        this.regexRule = regexRule;
        this.referenceID = referenceID;
    }

    public abstract toWrapper(): NumericalOrCategoricalCriterion;

    public getNumericalCriterion() {
        return this instanceof NumericalCriterion ? this : undefined;
    }

    public getCategoricalCriterion() {
        return this instanceof CategoricalCriterion ? this : undefined;
    }

    public visbilityToString(): string {
        return VisibilityUtils.toString(this.visibility);
    }
}

@JsonIdentityInfo({ generator: ObjectIdGenerator.IntSequenceGenerator, property: "@id" })
@JsonTypeName({ value: 'numerical' })
export class NumericalCriterion extends Criterion {
    static DEFAULT_SHOW_SLIDER = true;

    @JsonProperty() @JsonClassType({ type: () => [Boolean] })
    integral: boolean;
    @JsonProperty() @JsonClassType({ type: () => [Numerical] })
    minValue: Numerical;
    @JsonProperty() @JsonClassType({ type: () => [Numerical] })
    maxValue: Numerical;
    @JsonProperty() @JsonClassType({ type: () => [Boolean] })
    showSlider: boolean;

    constructor(name: string, description: string | ConditionalString, integral: boolean, minValue: Numerical | number, maxValue: Numerical | number, visibility: Visibility, shortDescription?: string, regexRule?: string, showSlider?: boolean) {
        super(name, description, visibility, shortDescription, regexRule);
        this.integral = integral;
        this.minValue = typeof minValue === "number" ? new Constant(minValue) : minValue;
        this.maxValue = typeof maxValue === "number" ? new Constant(maxValue) : maxValue;
        this.showSlider = showSlider ?? NumericalCriterion.DEFAULT_SHOW_SLIDER;
    }

    public toWrapper(): NumericalOrCategoricalCriterion {
        return new NumericalOrCategoricalCriterion(this);
    }

    public reasonForMinAsHtml(values: CriteriaValues): string {
        return this.minValue.conditionAsColorCodedHtml(values, false);
    }

    public reasonForMaxAsHtml(values: CriteriaValues): string {
        return this.maxValue.conditionAsColorCodedHtml(values, true);
    }
}

@JsonIdentityInfo({ generator: ObjectIdGenerator.IntSequenceGenerator, property: "@id" })
@JsonTypeName({ value: 'categorical' })
export class CategoricalCriterion extends Criterion {
    @JsonProperty() @JsonClassType({ type: () => [Array, [CategoricalCriterionValue]] })
    values: CategoricalCriterionValue[];

    /**
     * values additionally provided for faster access to the names of the valuesWithSynonyms
     */
    valueNames: string[];

    constructor(name: string, description: string | ConditionalString, values: CategoricalCriterionValue[] | string[], visibility: Visibility, shortDescription?: string, regexRule?: string) {
        super(name, description, visibility, shortDescription, regexRule);
        this.values = [];
        this.valueNames = [];
        for (let value of values) {
            this.values.push(typeof value === 'string' ? new CategoricalCriterionValue(value.toString()) : value);
            this.valueNames.push(typeof value === 'string' ? value : value.name);
        }
    }

    public toWrapper(): NumericalOrCategoricalCriterion {
        return new NumericalOrCategoricalCriterion(this);
    }
}


export class CategoricalCriterionValue extends Named {
    @JsonProperty() @JsonClassType({ type: () => [Array, [String]] })
    synonyms?: string[];

    constructor(name: string, description?: string, synonyms?: string[]) {
        super(name, description ?? "");
        //extract non-sense synonyms like the empty string or just a space
        if (synonyms != undefined) {
            this.synonyms = synonyms.filter((name) => (name != "") && (name != " "));
        }
    }
}


/**
* Wrapper class used for any criterion for internal use.
* It was created to allow proper deserialization of a criterion where we do not know the type
* of (numerical or categorical).
*/
export class NumericalOrCategoricalCriterion {
    @JsonProperty() @JsonClassType({ type: () => [NumericalCriterion] })
    private numericalCriterion?: NumericalCriterion;
    @JsonProperty() @JsonClassType({ type: () => [CategoricalCriterion] })
    private categoricalCriterion?: CategoricalCriterion;

    constructor(criterion: Criterion) {
        if (criterion instanceof NumericalCriterion) {
            this.numericalCriterion = criterion;
        }
        else if (criterion instanceof CategoricalCriterion) {
            this.categoricalCriterion = criterion;
        }
    }

    public getCriterion(): Criterion {
        return this.numericalCriterion instanceof NumericalCriterion ? this.numericalCriterion : this.categoricalCriterion instanceof CategoricalCriterion ? this.categoricalCriterion : new CategoricalCriterion("dummy", "", [], Visibility.NEVER);
    }

    public getNumericalCriterion(): NumericalCriterion | undefined {
        return this.numericalCriterion;
    }

    public getCategoricalCriterion(): CategoricalCriterion | undefined {
        return this.categoricalCriterion;
    }

    public isNumerical(): boolean {
        return this.numericalCriterion instanceof NumericalCriterion;
    }

    public isCategorical(): boolean {
        return this.categoricalCriterion instanceof CategoricalCriterion;
    }
}

export enum DataSource {
    MANUAL = "MANUAL",
    INFERRED = "INFERRED",
    COMBINED = "COMBINED",
    TEXT = "TEXT",
    PDF = "PDF",
    IMAGE = "IMAGE",
    AUDIO = "AUDIO",
    UNKNOWN = "UNKNOWN",
    NOT_SET = "NOT_SET",
}

class DataSourceUtils {
    public static toString(dataSource: DataSource): string {
        switch (dataSource) {
            case DataSource.MANUAL: return "manual";
            case DataSource.INFERRED: return "inferred";
            case DataSource.COMBINED: return "combined";
            case DataSource.TEXT: return "text";
            case DataSource.PDF: return "pdf";
            case DataSource.IMAGE: return "image";
            case DataSource.AUDIO: return "audio";
            case DataSource.UNKNOWN: return "unknown";
            case DataSource.NOT_SET: return "not set";
        }
        return "";
    }
}

@JsonTypeInfo({ use: JsonTypeInfoId.NAME, include: JsonTypeInfoAs.PROPERTY, property: "@type" })
@JsonSubTypes({
    types: [
        { class: () => NumericalDataRecord, name: 'numerical' },
        { class: () => CategoricalDataRecord, name: 'categorical' },
    ]
})
export abstract class DataRecord<T> {
    @JsonProperty() @JsonClassType({ type: () => [String] })
    public dataSource: DataSource;
    @JsonProperty() @JsonClassType({ type: () => [Date] })
    private time?: Date; //private to avoid changes from outside to keep it sorted in a data record list. If needed to change delete this and create a new DataRecord
    @JsonProperty() @JsonClassType({ type: () => [Date] })
    private entryCreatedTime: Date; //private to avoid changes from outside to keep it sorted in a data record list. If needed to change delete this and create a new DataRecord

    constructor(dataSource?: DataSource, time?: Date, entryCreatedTime?: Date) {
        this.time = time;
        this.dataSource = dataSource ?? DataSource.UNKNOWN;
        this.entryCreatedTime = entryCreatedTime ?? new Date();
    }

    public getTime(): Date | undefined {
        if (this.time == undefined) {
            return undefined;
        }
        return new Date(this.time); //return a copy (to avoid changes from outside)
    }

    public getTimeAsString(): string {
        return DataRecord.getTimeString(this.getTime());
    }

    public getEntryCreatedTimeAsString(): string {
        return DataRecord.getTimeString(this.getEntryCreatedTime());
    }

    private static getTimeString(time: Date | undefined) {
        //   const options: Intl.DateTimeFormatOptions = {
        //       year: 'numeric',
        //       month: '2-digit',
        //       day: '2-digit',
        //       hour: '2-digit',
        //       minute: '2-digit',
        //   };

        //   if (time != undefined) {
        //       return time.toLocaleDateString('de-DE', options);
        //   }
        if (time != undefined) {
            // Options for formatting date and time
            const optionsDate: Intl.DateTimeFormatOptions = {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
            };
            const optionsTime: Intl.DateTimeFormatOptions = {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false, // Use 24-hour format
            };

            // Format date and time separately
            const formattedDate = time.toLocaleDateString('en-CA', optionsDate).replace(/-/g, '/');
            const formattedTime = time.toLocaleTimeString('en-GB', optionsTime);
            return `${formattedDate}, ${formattedTime}`;
        }

        return Constants.STRING_NO_TIME;
    }

    public getEntryCreatedTime(): Date | undefined {
        return new Date(this.entryCreatedTime); //return a copy (to avoid changes from outside)
    }

    public abstract getValue(): T;

    public getValueAsString(): string {
        return CriteriaValues.getShortString(this);
    }

    public getDataSourceAsString(): string {
        return DataSourceUtils.toString(this.dataSource);
    }

    /**
     * creates a shallow copy where some parameters may be set to something new; for the values that are undefined we keep the old value.
     * 
     * setTimeToUndefined should be set to true if you want to set the new time to undefined instead of keeping the old time.
     */
    public abstract copy(newValue?: T, newDataSource?: DataSource, newTime?: Date, newEntryCreatedTime?: Date, setTimeToUndefined?: boolean): DataRecord<T>;
}

@JsonTypeName({ value: 'numerical' })
export class NumericalDataRecord extends DataRecord<Range> {

    @JsonProperty() @JsonClassType({ type: () => [Range] })
    public value: Range;

    constructor(value: Range, dataSource?: DataSource, time?: Date, entryCreatedTime?: Date) {
        super(dataSource, time, entryCreatedTime);
        this.value = value;
    }

    public getValue(): Range {
        return this.value;
    }

    public copy(newValue?: Range, newDataSource?: DataSource, newTime?: Date, newEntryCreatedTime?: Date, setTimeToUndefined?: boolean) {
        return new NumericalDataRecord(newValue ?? this.value, newDataSource ?? this.dataSource, setTimeToUndefined ? undefined : (newTime ?? this.getTime()), newEntryCreatedTime ?? this.getEntryCreatedTime());
    }
}

@JsonTypeName({ value: 'categorical' })
export class CategoricalDataRecord extends DataRecord<string[]> {

    @JsonProperty() @JsonClassType({ type: () => [Array, [String]] })
    public value: string[];

    constructor(value: string[], dataSource?: DataSource, time?: Date, entryCreatedTime?: Date) {
        super(dataSource, time, entryCreatedTime);
        this.value = value;
    }

    public getValue(): string[] {
        return this.value;
    }

    public copy(newValue?: string[], newDataSource?: DataSource, newTime?: Date, newEntryCreatedTime?: Date, setTimeToUndefined?: boolean) {
        return new CategoricalDataRecord(newValue ?? this.value, newDataSource ?? this.dataSource, setTimeToUndefined ? undefined : (newTime ?? this.getTime()), newEntryCreatedTime ?? this.getEntryCreatedTime());
    }
}

// default data selection is LATEST_ENTRY_CREATED_TIME ! To change, find occurrences in the code.
export enum DataSelection {
    LATEST = "LATEST",
    OLDEST = "OLDEST",
    LATEST_ENTRY_CREATED_TIME = "LATEST_ENTRY_CREATED_TIME",
    OLDEST_ENTRY_CREATED_TIME = "OLDEST_ENTRY_CREATED_TIME",
    UNION = "UNION",
    INTERSECTION = "INTERSECTION",
    MIN = "MIN",
    MAX = "MAX",
    MEAN = "MEAN",
    MEDIAN = "MEDIAN",
    MODE = "MODE", //in case of a draw the latest mode is returned
}

@JsonTypeInfo({ use: JsonTypeInfoId.NAME, include: JsonTypeInfoAs.PROPERTY, property: "@type" })
@JsonSubTypes({
    types: [
        { class: () => NumericalRecordList, name: 'numerical' },
        { class: () => CategoricalRecordList, name: 'categorical' },
    ]
})
export abstract class RecordList<T> implements Iterable<DataRecord<T>> {
    protected listWithTime: DataRecord<T>[] = []; //sorted increasingly by time
    protected listWithoutTime: DataRecord<T>[] = []; //sorted increasingly by entryCreatedTime

    constructor(initialEntries?: DataRecord<T>[]) {
        if (initialEntries != undefined) {
            for (let entry of initialEntries) {
                this.add(entry);
            }
        }
    }

    public abstract get(dataSelection?: DataSelection, associatedCriterion?: Criterion): DataRecord<T>;
    public abstract clone(): RecordList<T>;

    public add(item: DataRecord<T>) {
        if (item.getTime() != undefined) {
            //if time is greater than time of last entry => append it to the end
            if (this.listWithTime.length === 0 || this.listWithTime[this.listWithTime.length - 1].getTime()?.getTime()! < item.getTime()?.getTime()!) {
                this.listWithTime.push(item);
            }
            else {
                var index = 0;
                for (; index < this.listWithTime.length; index++) {
                    if (this.listWithTime[index].getTime()?.getTime()! > item.getTime()?.getTime()!) {
                        break;
                    }
                }
                this.listWithTime.splice(index, 0, item);
            }
        }
        else {
            //if entryCreatedTime is greater than entryCreatedTime of last entry => append it to the end
            if (this.listWithoutTime.length === 0 || this.listWithoutTime[this.listWithoutTime.length - 1].getEntryCreatedTime()?.getTime()! < item.getEntryCreatedTime()?.getTime()!) {
                this.listWithoutTime.push(item);
            }
            else {
                var index = 0;
                for (; index < this.listWithoutTime.length; index++) {
                    if (this.listWithoutTime[index].getEntryCreatedTime()?.getTime()! > item.getEntryCreatedTime()?.getTime()!) {
                        break;
                    }
                }
                this.listWithoutTime.splice(index, 0, item);
            }
        }
    }

    public remove(item: DataRecord<T>) {
        var index = this.listWithTime.indexOf(item);
        if (index !== -1) {
            this.listWithTime.splice(index, 1);
        }
        else {
            index = this.listWithoutTime.indexOf(item);
            if (index !== -1) {
                this.listWithoutTime.splice(index, 1);
            }
        }
    }

    public removeValue(value: T) {
        for (let list of [this.listWithTime, this.listWithoutTime]) {
            const indicesToBeRemoved = [];
            for (var i = list.length - 1; i >= 0; i--) {
                if (RecordList.equals(list[i].getValue(), value)) {
                    indicesToBeRemoved.push(i);
                }
            }
            for (let index of indicesToBeRemoved) {
                list.splice(index, 1);
            }
        }
    }

    public hasRecord(item: DataRecord<T>) {
        return this.listWithTime.includes(item) || this.listWithoutTime.includes(item);
    }

    public hasValue(value: T) {
        for (let list of [this.listWithTime, this.listWithoutTime]) {
            for (let entry of list) {
                if (RecordList.equals(entry.getValue(), value)) {
                    return true;
                }
            }
        }
        return false;
    }

    public changeTime(item: DataRecord<T>, newTime?: Date, newEntryCreatedTime?: Date, setTimeToUndefined?: boolean) {
        if (this.hasRecord(item)) {
            //remove old entry (to keep the two internal lists sorted correctly)
            this.remove(item);
            //create new item with old data and only change the time
            this.add(item.copy(undefined, undefined, newTime, newEntryCreatedTime, setTimeToUndefined));
        }
    }

    public size() {
        return this.listWithTime.length + this.listWithoutTime.length;
    }

    *[Symbol.iterator](): Iterator<DataRecord<T>> {
        //iterate in reverse order
        for (let i = this.listWithoutTime.length - 1; i >= 0; --i) {
            yield this.listWithoutTime[i];
        }
        for (let i = this.listWithTime.length - 1; i >= 0; --i) {
            yield this.listWithTime[i];
        }
    }

    private static equals<T>(value0: T, value1: T) {
        if (Array.isArray(value0) && Array.isArray(value1) &&
            value0.every(item => typeof item === 'string') &&
            value1.every(item => typeof item === 'string')) {
            return CriteriaValues.categoricalValuesAreTheSame(value0 as string[], value1 as string[]);
        }
        else if (value0 instanceof Range && value1 instanceof Range) {
            return CriteriaValues.numericalValuesAreTheSame(value0, value1);
        }
        else {
            return value0 === value1;
        }
    }
}

@JsonTypeName({ value: 'numerical' })
export class NumericalRecordList extends RecordList<Range> {

    public clone() {
        const copyList = new NumericalRecordList();
        for (let entry of this) {
            const time = entry.getTime();
            const entryCreated = entry.getEntryCreatedTime();
            copyList.add(new NumericalDataRecord(entry.getValue().clone(), entry.dataSource, time == undefined ? undefined : new Date(time), entryCreated == undefined ? undefined : new Date(entryCreated)));
        }
        return copyList;
    }

    public get(dataSelection?: DataSelection, associatedCriterion?: NumericalCriterion): DataRecord<Range> {
        if (dataSelection == undefined) {
            dataSelection = DataSelection.LATEST_ENTRY_CREATED_TIME;
        }

        const latestEntry = this.listWithTime[this.listWithTime.length - 1] ?? this.listWithoutTime[this.listWithoutTime.length - 1];

        if (latestEntry == undefined) {
            const undefinedRange = associatedCriterion != undefined ? CriteriaValues.getUndefinedRange(associatedCriterion) : new Range(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY);
            return new NumericalDataRecord(undefinedRange, DataSource.NOT_SET);
        }

        switch (dataSelection) {
            case DataSelection.LATEST:
                return this.listWithTime.length > 0 ? this.listWithTime[this.listWithTime.length - 1] : this.listWithoutTime[this.listWithoutTime.length - 1]

            case DataSelection.OLDEST:
                return this.listWithTime.length > 0 ? this.listWithTime[0] : this.listWithoutTime[0];

            case DataSelection.LATEST_ENTRY_CREATED_TIME:
                return this.listWithTime.length === 0 ? this.listWithoutTime[this.listWithoutTime.length - 1] : this.listWithoutTime.length === 0 ? this.listWithTime[this.listWithTime.length - 1] : this.listWithoutTime[this.listWithoutTime.length - 1].getEntryCreatedTime()?.getTime()! > this.listWithTime[this.listWithTime.length - 1].getEntryCreatedTime()?.getTime()! ? this.listWithoutTime[this.listWithoutTime.length - 1] : this.listWithTime[this.listWithTime.length - 1];

            case DataSelection.OLDEST_ENTRY_CREATED_TIME:
                return this.listWithTime.length === 0 ? this.listWithoutTime[0] : this.listWithoutTime.length === 0 ? this.listWithTime[0] : this.listWithoutTime[0].getEntryCreatedTime()?.getTime()! < this.listWithTime[0].getEntryCreatedTime()?.getTime()! ? this.listWithoutTime[0] : this.listWithTime[0];

            case DataSelection.UNION:
                return this.combineRanges(latestEntry, NumericalOperator.UNION);

            case DataSelection.INTERSECTION:
                return this.combineRanges(latestEntry, NumericalOperator.INTERSECTION);

            case DataSelection.MIN:
                return this.combineRanges(latestEntry, NumericalOperator.MIN);

            case DataSelection.MAX:
                return this.combineRanges(latestEntry, NumericalOperator.MAX);

            case DataSelection.MEAN:
                return this.meanOrMedianRange(true);

            case DataSelection.MEDIAN:
                return this.meanOrMedianRange(false);

            case DataSelection.MODE:
                return this.getMode(latestEntry);
        }
    }

    private combineRanges(sampleEntry: DataRecord<Range>, operator: NumericalOperator) {
        var combinedRange: Range | number | undefined = sampleEntry.getValue();
        var combined = false;
        for (let list of [this.listWithTime, this.listWithoutTime]) {
            for (let entry of list) {
                if (entry != sampleEntry) {
                    combinedRange = NumericalOperatorExecuter.evaluate(combinedRange, operator, entry.getValue());
                    combined = true;
                }
            }
        }
        if (combined && combinedRange != undefined) {
            if (typeof combinedRange === 'number') {
                combinedRange = new Range(combinedRange, combinedRange);
            }
            return new NumericalDataRecord(combinedRange, DataSource.COMBINED);
        }
        return sampleEntry;
    }

    private meanOrMedianRange(trueMeanFalseMedian: boolean) {
        const sampleEntry = this.listWithTime[0] ?? this.listWithoutTime[0];
        if (this.size() <= 1) {
            return sampleEntry;
        }
        var sum = 0;
        const medianList = [];
        for (let list of [this.listWithTime, this.listWithoutTime]) {
            for (let entry of list) {
                if (trueMeanFalseMedian) {
                    //compute mean (first mean of given range, later mean of these values)
                    sum += entry.getValue().getMean();
                }
                else {
                    medianList.push(entry);
                }
            }
        }
        if (trueMeanFalseMedian) {
            const mean = sum / this.size();
            return new NumericalDataRecord(new Range(mean, mean), DataSource.COMBINED);
        }
        else {
            medianList.sort((a, b) => {
                const meanA = a.getValue().getMean();
                const meanB = b.getValue().getMean();
                return meanA - meanB;
            });
            if (this.size() % 2 === 0) {
                //even number -> return the middle range starting earlier
                if (medianList[medianList.length / 2 - 1].getValue().start < medianList[medianList.length / 2].getValue().start) {
                    return medianList[medianList.length / 2 - 1];
                }
            }
            //both else cases
            return medianList[medianList.length / 2];
        }
    }

    private getMode(sampleEntry: DataRecord<Range>) {
        const frequency: Map<DataRecord<Range>, number> = new Map();
        for (let list of [this.listWithTime, this.listWithoutTime]) {
            for (let entry of list) {
                var added = false;
                for (let key of frequency.keys()) {
                    if (key.getValue().start === entry.getValue().start && key.getValue().end === entry.getValue().end) {
                        frequency.set(key, (frequency.get(key) ?? 0) + 1);
                        added = true;
                        break;
                    }
                }
                if (!added) {
                    frequency.set(entry, 1);
                }
            }
        }
        //return entry of highest frequency (may not be unique, but then just one is returned)
        var max = 0;
        var maxEntry: DataRecord<Range> = sampleEntry;
        for (let entry of frequency.entries()) {
            if (entry[1] > max) {
                maxEntry = entry[0];
                max = entry[1];
            }
        }
        if (max <= 0) {
            return maxEntry;
        }
        else {
            return new NumericalDataRecord(new Range(maxEntry.getValue().start, maxEntry.getValue().end), DataSource.COMBINED);
        }
    }


    public static areTheSame(list0: NumericalRecordList, list1: NumericalRecordList): boolean {
        //compare entry by entry (time and data source is ignored except for that they define the order in which we compare!!)
        const it0 = list0[Symbol.iterator]();
        const it1 = list1[Symbol.iterator]();
        let item0 = it0.next();
        let item1 = it1.next();
        while (!item0.done && !item1.done) {
            if (!CriteriaValues.numericalValuesAreTheSame(item0.value.getValue(), item1.value.getValue())) {
                return false;
            }
            item0 = it0.next();
            item1 = it1.next();
        }
        return true;
    }
}

@JsonTypeName({ value: 'categorical' })
export class CategoricalRecordList extends RecordList<string[]> {

    public clone() {
        const copyList = new CategoricalRecordList();
        for (let entry of this) {
            const time = entry.getTime();
            const entryCreated = entry.getEntryCreatedTime();
            copyList.add(new CategoricalDataRecord([...entry.getValue()], entry.dataSource, time == undefined ? undefined : new Date(time), entryCreated == undefined ? undefined : new Date(entryCreated)));
        }
        return copyList;
    }

    public get(dataSelection?: DataSelection, associatedCriterion?: Criterion): DataRecord<string[]> {
        if (dataSelection == undefined) {
            dataSelection = DataSelection.LATEST_ENTRY_CREATED_TIME;
        }

        const latestEntry = this.listWithTime[this.listWithTime.length - 1] ?? this.listWithoutTime[this.listWithoutTime.length - 1];

        switch (dataSelection) {
            case DataSelection.LATEST:
                return this.listWithTime.length > 0 ? this.listWithTime[this.listWithTime.length - 1] : this.listWithoutTime[this.listWithoutTime.length - 1]

            case DataSelection.OLDEST:
                return this.listWithTime.length > 0 ? this.listWithTime[0] : this.listWithoutTime[0];

            case DataSelection.LATEST_ENTRY_CREATED_TIME:
                return this.listWithTime.length === 0 ? this.listWithoutTime[this.listWithoutTime.length - 1] : this.listWithoutTime.length === 0 ? this.listWithTime[this.listWithTime.length - 1] : this.listWithoutTime[this.listWithoutTime.length - 1].getEntryCreatedTime()?.getTime()! > this.listWithTime[this.listWithTime.length - 1].getEntryCreatedTime()?.getTime()! ? this.listWithoutTime[this.listWithoutTime.length - 1] : this.listWithTime[this.listWithTime.length - 1];

            case DataSelection.OLDEST_ENTRY_CREATED_TIME:
                return this.listWithTime.length === 0 ? this.listWithoutTime[0] : this.listWithoutTime.length === 0 ? this.listWithTime[0] : this.listWithoutTime[0].getEntryCreatedTime()?.getTime()! < this.listWithTime[0].getEntryCreatedTime()?.getTime()! ? this.listWithoutTime[0] : this.listWithTime[0];

            case DataSelection.UNION:
                return this.combineEntries(latestEntry, DataSelection.UNION, associatedCriterion);

            case DataSelection.INTERSECTION:
                return this.combineEntries(latestEntry, DataSelection.INTERSECTION, associatedCriterion);

            case DataSelection.MIN:
                return this.asOrdinalValue(latestEntry, DataSelection.MIN, associatedCriterion);

            case DataSelection.MAX:
                return this.asOrdinalValue(latestEntry, DataSelection.MAX, associatedCriterion);

            case DataSelection.MEAN:
                return this.asOrdinalValue(latestEntry, DataSelection.MEAN, associatedCriterion);

            case DataSelection.MEDIAN:
                return this.asOrdinalValue(latestEntry, DataSelection.MEDIAN, associatedCriterion);

            case DataSelection.MODE:
                return this.getMode(latestEntry);
        }
    }

    private combineEntries(sampleEntry: DataRecord<string[]>, operator: DataSelection, associatedCriterion?: Criterion) {
        const combinationList: string[] = [];
        var combined = false;
        for (let list of [this.listWithTime, this.listWithoutTime]) {
            for (let entry of list) {
                for (let value of entry.getValue()) {
                    if (!combinationList.includes(value)) {
                        if (operator === DataSelection.UNION) {
                            combinationList.push(value);
                        }
                        else if (operator === DataSelection.INTERSECTION) {
                            combinationList.splice(combinationList.indexOf(value), 1); //remove it because it is not contained here
                        }
                    }
                }
                combined = true;
            }
        }
        if (combined) {
            //bring the order of values in the same order as given by the criterion; however, we might not have this info here.
            if (associatedCriterion instanceof CategoricalCriterion) {
                const orderedCombinationList = [];
                for (let value of associatedCriterion.valueNames) {
                    if (combinationList.includes(value)) {
                        orderedCombinationList.push(value)
                        //remove it from the combinationList
                        combinationList.splice(combinationList.indexOf(value), 1);
                    }
                }
                //append entries we have not found a counterpart for at the end
                orderedCombinationList.push(...combinationList);
                return new CategoricalDataRecord(orderedCombinationList, DataSource.COMBINED);
            }
            return new CategoricalDataRecord(combinationList, DataSource.COMBINED);
        }
        return sampleEntry;
    }

    private asOrdinalValue(sampleEntry: DataRecord<string[]>, operator: DataSelection, associatedCriterion?: Criterion) {
        if (this.size() <= 1) {
            return sampleEntry;
        }
        if (!(associatedCriterion instanceof CategoricalCriterion)) {
            return new CategoricalDataRecord([], DataSource.COMBINED);
        }
        //create mapping value of criterion to index
        const value2index = new Map<string, number>();
        const index2value = new Map<number, string>();
        var index = 0;
        for (let value of associatedCriterion.valueNames) {
            value2index.set(value, index);
            index2value.set(index, value);
            ++index;
        }
        //determine min/max/mean/median
        var min = Number.POSITIVE_INFINITY;
        var max = Number.NEGATIVE_INFINITY;
        var sum = 0;
        var count = 0;
        const medianList = []; //add maybe same string multiple times (so number of occurrences influences the median)
        for (let list of [this.listWithTime, this.listWithoutTime]) {
            for (let entry of list) {
                for (let value of entry.getValue()) {
                    const index = value2index.get(value);
                    if (index == undefined) {
                        return new CategoricalDataRecord([], DataSource.COMBINED);
                    }
                    min = Math.min(min, index);
                    max = Math.max(max, index);
                    sum += index;
                    ++count;
                    medianList.push(index);
                }
            }
        }
        const minValue = index2value.get(min);
        const maxValue = index2value.get(max);
        const meanValue = index2value.get(Math.round(sum / count));
        medianList.sort();
        const medianValue = index2value.get(medianList[medianList.length / 2]);
        if (operator === DataSelection.MIN && minValue != undefined) {
            return new CategoricalDataRecord([minValue], DataSource.COMBINED);
        }
        else if (operator === DataSelection.MAX && maxValue != undefined) {
            return new CategoricalDataRecord([maxValue], DataSource.COMBINED);
        }
        else if (operator === DataSelection.MEAN && meanValue != undefined) {
            return new CategoricalDataRecord([meanValue], DataSource.COMBINED);
        }
        else if (operator === DataSelection.MEDIAN && medianValue != undefined) {
            return new CategoricalDataRecord([medianValue], DataSource.COMBINED);
        }
        return new CategoricalDataRecord([], DataSource.COMBINED);
    }

    private getMode(sampleEntry: DataRecord<string[]>) {
        if (this.size() <= 1) {
            return sampleEntry;
        }

        const frequency: Map<string, number> = new Map();
        for (let list of [this.listWithTime, this.listWithoutTime]) {
            for (let entry of list) {
                for (let value of entry.getValue()) {
                    frequency.set(value, (frequency.get(value) ?? 0) + 1);
                }
            }
        }
        //return entry of highest frequency (may not be unique, but then just one is returned)
        var max = 0;
        var maxValues: string[] = [];
        for (let entry of frequency.entries()) {
            if (entry[1] > max) {
                maxValues = [entry[0]];
                max = entry[1];
            }
            else if (entry[1] === max) {
                maxValues.push(entry[0]);
            }
        }
        return new CategoricalDataRecord(maxValues, DataSource.COMBINED);
    }


    public static areTheSame(list0: CategoricalRecordList, list1: CategoricalRecordList): boolean {
        //compare entry by entry (time and data source is ignored except for that they define the order in which we compare!!)
        const it0 = list0[Symbol.iterator]();
        const it1 = list1[Symbol.iterator]();
        let item0 = it0.next();
        let item1 = it1.next();
        while (!item0.done && !item1.done) {
            if (!CriteriaValues.categoricalValuesAreTheSame(item0.value.getValue(), item1.value.getValue())) {
                return false;
            }
            item0 = it0.next();
            item1 = it1.next();
        }
        return true;
    }
}

export class CriteriaValues {
    @JsonProperty() @JsonClassType({ type: () => [Map, [NumericalCriterion, NumericalRecordList]] })
    private numericalValues: Map<NumericalCriterion, NumericalRecordList> = new Map();
    @JsonProperty() @JsonClassType({ type: () => [Map, [NumericalCriterion, CategoricalRecordList]] })
    private categoricalValues: Map<CategoricalCriterion, CategoricalRecordList> = new Map();

    public isEmpty(): boolean {
        return this.getAllSetCriteria().length === 0;
    }

    public has(criterion: Criterion) {
        return (criterion instanceof NumericalCriterion ? this.numericalValues.has(criterion) : criterion instanceof CategoricalCriterion ? this.categoricalValues.has(criterion) : undefined) ?? false;
    }

    public getAllSetCriteria(): Criterion[] {
        const criteria = [];
        for (let criterionWithList of this.getAllAvailableLists()) {
            const criterion = criterionWithList[0];
            if (!this.isAllUndefined(criterion)) {
                criteria.push(criterion);
            }
        }
        return criteria;
    }

    public getAllAvailableLists() {
        return [...this.getAllAvailableCategoricalLists(), ...this.getAllAvailableNumericalLists()];
    }

    public getAllAvailableNumericalLists() {
        return this.numericalValues.entries();
    }

    public getAllAvailableCategoricalLists() {
        return this.categoricalValues.entries();
    }

    public getAllNumericalEntries(criterion: NumericalCriterion): NumericalRecordList {
        if (this.numericalValues.get(criterion) == undefined) {
            this.numericalValues.set(criterion, new NumericalRecordList());
        }
        return this.numericalValues.get(criterion) ?? new NumericalRecordList();
    }

    public getNumericalEntry(criterion: NumericalCriterion, dataSelection?: DataSelection): DataRecord<Range> {
        return this.numericalValues.get(criterion)?.get(dataSelection, criterion) ?? new NumericalDataRecord(CriteriaValues.getUndefinedRange(criterion, this), DataSource.NOT_SET);
    }

    public getNumerical(criterion: NumericalCriterion, dataSelection?: DataSelection): Range {
        return this.getNumericalEntry(criterion, dataSelection).getValue();
    }

    public getNumericalAsCopy(criterion: NumericalCriterion, dataSelection?: DataSelection): Range {
        if (!this.isUndefined(criterion, dataSelection)) {
            const currentRange = this.getNumerical(criterion, dataSelection);
            return new Range(currentRange.start, currentRange.end, currentRange.integral);
        }
        return CriteriaValues.getUndefinedRange(criterion, this);
    }

    public getAllCategoricalEntries(criterion: CategoricalCriterion): CategoricalRecordList {
        if (this.categoricalValues.get(criterion) == undefined) {
            this.categoricalValues.set(criterion, new CategoricalRecordList());
        }
        return this.categoricalValues.get(criterion) ?? new CategoricalRecordList();
    }

    public getCategoricalEntry(criterion: CategoricalCriterion, dataSelection?: DataSelection): DataRecord<string[]> {
        if (!this.categoricalValues.has(criterion)) {
            const recordList = new CategoricalRecordList();
            recordList.add(new CategoricalDataRecord([]))
            this.categoricalValues.set(criterion, recordList);
        }
        return this.categoricalValues.get(criterion)?.get(dataSelection, criterion) ?? new CategoricalDataRecord([]);
    }

    public getCategorical(criterion: CategoricalCriterion, dataSelection?: DataSelection): string[] {
        return this.getCategoricalEntry(criterion, dataSelection).getValue();
    }

    public getCategoricalAsCopy(criterion: CategoricalCriterion, dataSelection?: DataSelection): string[] {
        const currentArray = this.getCategorical(criterion, dataSelection);
        if (currentArray != undefined) {
            return [...currentArray];
        }
        return [];
    }

    public getAllEntries(criterion: Criterion): RecordList<any> {
        if (criterion instanceof NumericalCriterion) {
            return this.getAllNumericalEntries(criterion);
        }
        else if (criterion instanceof CategoricalCriterion) {
            return this.getAllCategoricalEntries(criterion);
        }
        return new CategoricalRecordList(); //this line should never be reached
    }

    public getEntry(criterion: Criterion, dataSelection?: DataSelection): DataRecord<Range> | DataRecord<string[]> {
        if (criterion instanceof NumericalCriterion) {
            return this.getNumericalEntry(criterion, dataSelection);
        }
        else if (criterion instanceof CategoricalCriterion) {
            return this.getCategoricalEntry(criterion, dataSelection);
        }
        return new CategoricalDataRecord([], DataSource.NOT_SET); //this line should never be reached
    }

    public get(criterion: Criterion, dataSelection?: DataSelection): Range | string[] {
        if (criterion instanceof NumericalCriterion) {
            return this.getNumerical(criterion, dataSelection);
        }
        else if (criterion instanceof CategoricalCriterion) {
            return this.getCategorical(criterion, dataSelection);
        }
        return [];
    }

    public removeEntry(criterion: Criterion, entry: DataRecord<any>) {
        if (criterion instanceof NumericalCriterion) {
            this.getAllNumericalEntries(criterion).remove(entry);
        }
        else if (criterion instanceof CategoricalCriterion) {
            this.getAllCategoricalEntries(criterion).remove(entry);
        }
    }

    public static getShortString(entry: DataRecord<any>) {
        if (entry.getValue() instanceof Range) {
            return this.getNumericalShortString(entry);
        }
        if (Array.isArray(entry.getValue())) {
            return this.getCategoricalShortString(entry);
        }
        return Constants.STRING_FOR_UNKNOWN;
    }

    public static getNumericalShortString(entry: DataRecord<Range>) {
        const value = entry.getValue();
        if (value.start === value.end) {
            return value.start + "";
        }
        return value + "";
    }

    public static getCategoricalShortString(entry: DataRecord<string[]>) {
        const catValues = entry.getValue();
        if (catValues.length == 0) {
            return Constants.STRING_FOR_UNDEFINED_CRITERION_VALUE;
        }
        if (catValues.length == 1) {
            return catValues[0];
        }
        var compoundString = Constants.STRING_FOR_ONE_IN_ARRAY_CRITERION_VALUE + "[";
        var firstIteration = true;
        for (let catValue of catValues) {
            if (!firstIteration) {
                compoundString += ", ";
            }
            else {
                firstIteration = false;
            }
            compoundString += catValue
        }
        compoundString += "]";
        return compoundString;
    }

    public getAsShortString(criterion: Criterion, dataSelection: DataSelection): string {
        if (criterion instanceof NumericalCriterion) {
            return CriteriaValues.getNumericalShortString(this.getNumericalEntry(criterion, dataSelection));
        }
        else if (criterion instanceof CategoricalCriterion) {
            return CriteriaValues.getCategoricalShortString(this.getCategoricalEntry(criterion, dataSelection));
        }
        return ""; //this line should never be reached
    }

    public getNumericalEntryAsLongString(entry: DataRecord<Range>) {
        return CriteriaValues.getNumericalShortString(entry) + " (" + Constants.STRING_TIME + ": " + entry.getTimeAsString() + ", " + Constants.STRING_SOURCE + ": " + entry.getDataSourceAsString() + ", " + Constants.STRING_ENTRY_CREATED + ": " + entry.getEntryCreatedTimeAsString() + ")";
    }

    public getCategoricalEntryAsLongString(entry: DataRecord<string[]>) {
        return CriteriaValues.getCategoricalShortString(entry) + " (" + Constants.STRING_TIME + ": " + entry.getTimeAsString() + ", " + Constants.STRING_SOURCE + ": " + entry.getDataSourceAsString() + ", " + Constants.STRING_ENTRY_CREATED + ": " + entry.getEntryCreatedTimeAsString() + ")";
    }

    public getAsLongString(criterion: Criterion, dataSelection?: DataSelection): string {
        if (criterion instanceof NumericalCriterion) {
            return this.getNumericalEntryAsLongString(this.getNumericalEntry(criterion, dataSelection));
        }
        else if (criterion instanceof CategoricalCriterion) {
            return this.getCategoricalEntryAsLongString(this.getCategoricalEntry(criterion, dataSelection));
        }
        return ""; //this line should never be reached
    }

    public getListAsString(criterion: Criterion, separateLines: boolean): string {
        var compoundString = separateLines ? "" : "[";
        var counter = 0;
        if (criterion instanceof NumericalCriterion) {
            var numEntries = [...this.getAllNumericalEntries(criterion)];
            numEntries = numEntries.filter(v => { return !(v.getValue().equals(CriteriaValues.getUndefinedRange(criterion, this))) }); //filter out undefined entries
            for (let entry of numEntries) {
                compoundString += this.getNumericalEntryAsLongString(entry);
                ++counter;
                if (counter < numEntries.length) {
                    compoundString += separateLines ? "\n" : ", ";
                }
            }
        }
        else if (criterion instanceof CategoricalCriterion) {
            var catEntries = [...this.getAllCategoricalEntries(criterion)];
            catEntries = catEntries.filter(v => { return v.getValue().length > 0 }); //filter out undefined entries
            for (let entry of catEntries) {
                compoundString += this.getCategoricalEntryAsLongString(entry);
                ++counter;
                if (counter < catEntries.length) {
                    compoundString += separateLines ? "\n" : ", ";
                }
            }
        }
        return compoundString + (separateLines ? "" : "]");
    }

    public getAllNumerical(): IterableIterator<[NumericalCriterion, NumericalRecordList]> {
        return this.numericalValues.entries();
    }

    public getAllCategorical(): IterableIterator<[CategoricalCriterion, CategoricalRecordList]> {
        return this.categoricalValues.entries();
    }

    public addEntry(criterion: Criterion, entry: DataRecord<any>) {
        if (criterion instanceof NumericalCriterion) {
            this.addNumericalEntry(criterion, entry);
        }
        else if (criterion instanceof CategoricalCriterion) {
            this.addCategoricalEntry(criterion, entry);
        }
    }

    public addNumericalEntry(criterion: NumericalCriterion, entry: DataRecord<Range>) {
        this.getAllNumericalEntries(criterion).add(entry);
    }

    public addNumerical(criterion: NumericalCriterion, value: Range, dataSource?: DataSource, time?: Date, entryCreatedTime?: Date) {
        this.addNumericalEntry(criterion, new NumericalDataRecord(value, dataSource, time, entryCreatedTime));
    }

    public addNumber(criterion: NumericalCriterion, value: number, dataSource?: DataSource, time?: Date) {
        this.addNumerical(criterion, new Range(value, value), dataSource, time);
    }

    public addCategoricalEntry(criterion: CategoricalCriterion, entry: DataRecord<string[]>) {
        //if there exits only one entry and this is undefined -> replace it by first deleting this unnecessary entry
        const existingEntries = this.getAllCategoricalEntries(criterion);
        if (existingEntries.size() === 1 && existingEntries.get().getValue().length === 0) { //length 0 means no string in it -> undefined
            existingEntries.remove(existingEntries.get());
        }
        //now regularlly add the new entry
        existingEntries.add(entry);
    }

    public addCategorical(criterion: CategoricalCriterion, value: string[], dataSource?: DataSource, time?: Date, entryCreatedTime?: Date) {
        this.addCategoricalEntry(criterion, new CategoricalDataRecord(value, dataSource, time, entryCreatedTime));
    }

    public isAllUndefined(criterion: Criterion): boolean {
        for (let entry of this.getAllEntries(criterion)) {
            if (!this.isUndefinedEntry(criterion, entry)) {
                return false;
            }
        }
        return true;
    }

    public isUndefined(criterion: Criterion, dataSelection?: DataSelection): boolean {
        return this.isUndefinedEntry(criterion, this.getEntry(criterion, dataSelection));
    }

    public isUndefinedEntry(criterion: Criterion, entry: DataRecord<any>): boolean {
        if (!this.has(criterion)) {
            return true;
        }
        if (criterion instanceof NumericalCriterion) {
            return this.isUndefinedNumericalEntry(criterion, entry);
        }
        else if (criterion instanceof CategoricalCriterion) {
            return this.isUndefinedCategoricalEntry(criterion, entry);
        }
        return false;
    }

    public isUndefinedNumericalEntry(criterion: NumericalCriterion, entry: DataRecord<Range>): boolean {
        const value = entry.getValue();
        if (value == undefined) {
            return true;
        }
        if (value.start === value.end) {
            return false;
        }
        //if the current value is identical to the undefined range (for the current criteria values or if no criteria values are set), then we return true.
        return CriteriaValues.numericalValuesAreTheSame(value, CriteriaValues.getUndefinedRange(criterion, this)) ||
            CriteriaValues.numericalValuesAreTheSame(value, CriteriaValues.getUndefinedRange(criterion, new CriteriaValues()));
    }

    public isUndefinedCategoricalEntry(criterion: CategoricalCriterion, entry: DataRecord<string[]>): boolean {
        return entry.getValue() == undefined || entry.getValue().length === 0 || entry.getValue().length === criterion.values.length;
    }

    /**
     * does not clear the record list, but instead adds the undefined range or empty array as the last entry.
     * If there is no entry yet, a new entry is added.
     * 
     * @param criterion 
     */
    public addUndefined(criterion: Criterion, dataSource?: DataSource, time?: Date) {
        if (criterion instanceof NumericalCriterion) {
            this.addNumerical(criterion, CriteriaValues.getUndefinedRange(criterion, new CriteriaValues()), dataSource, time);
        }
        else if (criterion instanceof CategoricalCriterion) {
            this.addCategorical(criterion, [], dataSource, time);
        }
    }

    public add(criterion: Criterion, value: Range | string[], dataSource?: DataSource, time?: Date, entryCreatedTime?: Date) {
        if (criterion instanceof NumericalCriterion && value instanceof Range) {
            this.addNumerical(criterion, value, dataSource, time, entryCreatedTime);
            return;
        }
        else if (criterion instanceof CategoricalCriterion && Array.isArray(value)) {
            this.addCategorical(criterion, value, dataSource, time, entryCreatedTime);
            return;
        }
        //else something is wrong -> set criterion to undefined
        this.addUndefined(criterion);
    }

    /**
     * 
     * @returns a deep copy of the current criteria values object
     */
    public clone(): CriteriaValues {
        const copyMap = new CriteriaValues();

        for (let criterionAndList of this.getAllNumerical()) {
            copyMap.numericalValues.set(criterionAndList[0], criterionAndList[1].clone());
        }
        for (let criterionAndList of this.getAllCategorical()) {
            copyMap.categoricalValues.set(criterionAndList[0], criterionAndList[1].clone());
        }

        return copyMap;
    }

    //static methods of CriteriaValues

    public static getUndefinedRange(criterion: NumericalCriterion, criteriaValues?: CriteriaValues): Range {
        return new Range(criterion.minValue.getValueLow(criteriaValues) ?? Constants.CRITERION_DEFAULT_MIN, criterion.maxValue.getValueHigh(criteriaValues) ?? Constants.CRITERION_DEFAULT_MAX);
    }

    public static numericalValuesAreTheSame(value0: Range, value1: Range): boolean {
        return value0.start == value1.start && value0.end == value1.end;
    }


    public static categoricalValuesAreTheSame(value0: string[], value1: string[]): boolean {
        //all of the following assumes that the same element is not contained multiple times in one array
        if (value0.length != value1.length) {
            return false;
        }
        for (let e of value0) {
            if (!value1.includes(e)) {
                return false;
            }
        }
        return true;
    }

    /**
     * 
     * @param values0 
     * @param values1 
     * @param dataSelection 
     *      if undefined, then all values are compared
     * @returns 
     */
    public static criteriaValuesAreTheSame(values0: CriteriaValues, values1: CriteriaValues, dataSelection?: DataSelection): boolean {
        const criteria0: Criterion[] = [];
        //first check that all criterion--value pairs from values0 appear identically in values1
        for (let criterionAndList of values0.getAllNumerical()) {
            const criterion = criterionAndList[0];
            criteria0.push(criterion);

            if (dataSelection == undefined) {
                const list0 = criterionAndList[1];
                const list1 = values1.getAllNumericalEntries(criterion);
                if (!NumericalRecordList.areTheSame(list0, list1)) {
                    return false;
                }
            }
            else {
                const value = values0.getNumerical(criterion, dataSelection);
                if (!CriteriaValues.numericalValuesAreTheSame(value, values1.getNumerical(criterion, dataSelection))) {
                    return false;
                }
            }
        }
        for (let criterionAndList of values0.getAllCategorical()) {
            const criterion = criterionAndList[0];
            criteria0.push(criterion);

            if (dataSelection == undefined) {
                const list0 = criterionAndList[1];
                const list1 = values1.getAllCategoricalEntries(criterion);
                if (!CategoricalRecordList.areTheSame(list0, list1)) {
                    return false;
                }
            }
            else {
                const value = values0.getCategorical(criterion, dataSelection);
                if (!CriteriaValues.categoricalValuesAreTheSame(value, values1.getCategorical(criterion, dataSelection))) {
                    return false;
                }
            }
        }
        //now check that there are no extra criterion--value pairs in values1 that appear not in values0
        for (let criterionAndList of values1.getAllNumerical()) {
            const criterion = criterionAndList[0];
            if (!criteria0.includes(criterion)) {
                return false;
            }
        }
        for (let criterionAndList of values1.getAllCategorical()) {
            const criterion = criterionAndList[0];
            if (!criteria0.includes(criterion)) {
                return false;
            }
        }

        return true;
    }
}

export enum NumericalOperator {
    PLUS = "PLUS",
    MINUS = "MINUS",
    TIMES = "TIMES",
    DIVIDED_BY = "DIVIDED_BY",
    POWER = "POWER",
    LOG = "LOG", //first entry of the logarithm is the base, the second is the argument, e.g., a LOG b = c  <=>  a^c = b
    MIN = "MIN",
    MAX = "MAX",
    MEAN = "MEAN",
    UNION = "UNION",
    INTERSECTION = "INTERSECTION",
}

class NumericalOperatorUtil {
    public static asSymbol(numericalOperator: NumericalOperator): string {
        switch (numericalOperator) {
            case NumericalOperator.PLUS: return "+";
            case NumericalOperator.MINUS: return "-";
            case NumericalOperator.TIMES: return "*";
            case NumericalOperator.DIVIDED_BY: return "/";
            case NumericalOperator.POWER: return "^";
            case NumericalOperator.LOG: return "<-(base)_log_(argument)->"
            case NumericalOperator.MIN: return "<-min->";
            case NumericalOperator.MAX: return "<-max->";
            case NumericalOperator.MEAN: return "<-mean->";
            case NumericalOperator.UNION: return "<-union->";
            case NumericalOperator.INTERSECTION: return "<-intersection->";
        }
        return "";
    }
}

class NumericalOperatorExecuter {
    public static evaluate(val0: number | Range | undefined, operator: NumericalOperator, val1: number | Range | undefined): number | Range | undefined {
        if (val0 == undefined || val1 == undefined) {
            return undefined;
        }
        const val0low = val0 instanceof Range ? val0.integral ? Math.round(val0.start) : val0.start : val0;
        const val0high = val0 instanceof Range ? val0.integral ? Math.round(val0.end) : val0.end : val0;
        const val1low = val1 instanceof Range ? val1.integral ? Math.round(val1.start) : val1.start : val1;
        const val1high = val1 instanceof Range ? val1.integral ? Math.round(val1.end) : val1.end : val1;

        var resultLow: number | undefined = undefined;
        var resultHigh: number | undefined = undefined;

        if (operator == NumericalOperator.PLUS) {
            resultLow = val0low + val1low;
            resultHigh = val0high + val1high;
        }
        else if (operator == NumericalOperator.MINUS) {
            resultLow = val0low - val1high;
            resultHigh = val0high - val1low;
        }
        else if (operator == NumericalOperator.TIMES) {
            const extremes = [val0low * val1low, val0low * val1high, val0high * val1low, val0high * val1high];
            resultLow = Math.min(...extremes);
            resultHigh = Math.max(...extremes);
        }
        else if (operator == NumericalOperator.DIVIDED_BY) {
            //if val1 is 0 or a range containing 0, we get infinity
            if (val1low <= 0 && val1high >= 0) {
                if (val0high >= 0) {
                    resultHigh = Number.POSITIVE_INFINITY;
                }
                if (val0low <= 0) {
                    resultLow = Number.NEGATIVE_INFINITY;
                }
            }
            const extremes = [];
            if (val1low != 0) {
                extremes.push(val0low / val1low);
                extremes.push(val0high / val1low);
            }
            if (val1high != 0) {
                extremes.push(val0low / val1high);
                extremes.push(val0high / val1high);
            }
            if (resultLow != Number.NEGATIVE_INFINITY) {
                resultLow = Math.min(...extremes);
            }
            if (resultHigh != Number.POSITIVE_INFINITY) {
                resultHigh = Math.max(...extremes);
            }

        }
        else if (operator == NumericalOperator.POWER) {
            // if 0 ** b  with b < 0 can occur, we have division by 0, whic results in positive infinity
            if (val0low <= 0 && val0high >= 0 && val1low < 0) {
                resultHigh = Number.POSITIVE_INFINITY
            }

            if (val0low >= 0) {
                const extremes = [val0low ** val1low, val0low ** val1high, val0high ** val1low, val0high ** val1high];
                resultLow = Math.min(...extremes);
                if (resultHigh != Number.POSITIVE_INFINITY) {
                    resultHigh = Math.max(...extremes);
                }
            }
            else {
                //we have val0low < 0
                // this means that we take a root from a negative number if val1 is not integral, which leads to undefined
                if ((val1 instanceof Range && !val1.integral && val1low != val1high) || (!(val1 instanceof Range) && val1 != Math.round(val1))) {
                    return undefined;
                }
                //otherwise the exponent val1 is integral and the values are negative or positive depending on whether val1 is even or odd
                // in terms of absolute values, the numbers get greater for greater values of val1
                // hence we only check val1high as exponent and we also take the next lower integer of val1high if possible
                const extremes = [val0low ** val1high, val0high ** val1high];
                if (val1high - 1 >= val1low) {
                    extremes.push(val0low ** (val1high - 1));
                    extremes.push(val0high ** (val1high - 1));
                }
                resultLow = Math.min(...extremes);
                if (resultHigh != Number.POSITIVE_INFINITY) {
                    resultHigh = Math.max(...extremes);
                }
            }
        }
        else if (operator == NumericalOperator.LOG) {
            if (val0low < 0 || val1low <= 0) {
                return undefined;
            }
            //if the argument can be 0, then the value becomes (negative) infinity
            if (val1low == 0) {
                if (val1low < 1) {
                    resultHigh = Number.POSITIVE_INFINITY;
                }
                if (val1high > 1) {
                    resultLow = Number.NEGATIVE_INFINITY;
                }
            }
            //if the base can be 1, then the value becomes (negative) infinity
            if (val0low <= 1 && val0high >= 1) {
                if (val1low < 1) {
                    resultLow = Number.NEGATIVE_INFINITY;
                }
                if (val1high > 1) {
                    resultHigh = Number.POSITIVE_INFINITY;
                }
            }

            const extremes = [];
            if (val0low != 1) {
                if (val1low != 0) {
                    extremes.push(Math.log(val1low) / Math.log(val0low));
                }
                if (val1high != 0) {
                    extremes.push(Math.log(val1high) / Math.log(val0low));
                }
            }
            if (val0high != 1) {
                if (val1low != 0) {
                    extremes.push(Math.log(val1low) / Math.log(val0high));
                }
                if (val1high != 0) {
                    extremes.push(Math.log(val1high) / Math.log(val0high));
                }
            }
            if (resultLow != Number.NEGATIVE_INFINITY) {
                resultLow = Math.min(...extremes);
            }
            if (resultHigh != Number.POSITIVE_INFINITY) {
                resultHigh = Math.max(...extremes);
            }
        }
        else if (operator == NumericalOperator.MIN) {
            resultLow = Math.min(val0low, val1low);
            resultHigh = Math.min(val0high, val1high);
        }
        else if (operator == NumericalOperator.MAX) {
            resultLow = Math.max(val0low, val1low);
            resultHigh = Math.max(val0high, val1high);
        }
        else if (operator == NumericalOperator.MEAN) {
            resultLow = (val0low + val1low) / 2.0;
            resultHigh = (val0high + val1high) / 2.0;
        }
        else if (operator == NumericalOperator.UNION) {
            resultLow = Math.min(val0low, val1low);
            resultHigh = Math.max(val0high, val1high);
        }
        else if (operator == NumericalOperator.INTERSECTION) {
            resultLow = Math.max(val0low, val1low);
            resultHigh = Math.min(val0high, val1high);
        }

        if (resultLow == undefined || resultHigh == undefined || resultLow > resultHigh) {
            return undefined;
        }
        //the case with neg and pos infinity occurs if we divide 0 by 0
        if (resultLow == Number.NEGATIVE_INFINITY && resultHigh == Number.POSITIVE_INFINITY) {
            return Number.NaN;
        }
        if (resultLow == resultHigh) {
            return resultLow; //we return a single number
        }
        //otherwise we return a range
        return new Range(resultLow, resultHigh);
    }
}

@JsonTypeName({ value: 'func' })
export class NumericalFunction extends Numerical {
    @JsonProperty() @JsonClassType({ type: () => [String] })
    operator: NumericalOperator;
    @JsonProperty() @JsonClassType({ type: () => [Numerical] })
    numerical0: Numerical;
    @JsonProperty() @JsonClassType({ type: () => [Numerical] })
    numerical1: Numerical;

    constructor(numerial0: Numerical, operator: NumericalOperator, numerical1: Numerical) {
        super();
        this.operator = operator;
        this.numerical0 = numerial0;
        this.numerical1 = numerical1;
    }

    override getValue(values: CriteriaValues): number | Range | undefined {
        return NumericalOperatorExecuter.evaluate(this.numerical0.getValue(values), this.operator, this.numerical1.getValue(values));
    }

    getInverseNumerical0(result: number | Range, values: CriteriaValues): number | Range | undefined {
        const value1 = this.numerical1.getValue(values);
        if (value1 == undefined) {
            return undefined;
        }
        switch (this.operator) {
            case NumericalOperator.PLUS: return NumericalOperatorExecuter.evaluate(result, NumericalOperator.MINUS, value1);
            case NumericalOperator.MINUS: return NumericalOperatorExecuter.evaluate(result, NumericalOperator.PLUS, value1);
            case NumericalOperator.TIMES: return NumericalOperatorExecuter.evaluate(result, NumericalOperator.DIVIDED_BY, value1);
            case NumericalOperator.DIVIDED_BY: return NumericalOperatorExecuter.evaluate(result, NumericalOperator.TIMES, value1);
            case NumericalOperator.POWER: return NumericalOperatorExecuter.evaluate(result, NumericalOperator.POWER, NumericalOperatorExecuter.evaluate(1, NumericalOperator.DIVIDED_BY, value1)); //result ** (1 / value1);
            case NumericalOperator.LOG: return NumericalOperatorExecuter.evaluate(value1, NumericalOperator.POWER, NumericalOperatorExecuter.evaluate(1, NumericalOperator.DIVIDED_BY, result)); //value1 ** (1 / result);
            case NumericalOperator.MIN: return NumberComparatorExecuter.evaluate(result, NumberComparator.LESS, value1) ? result : undefined;
            case NumericalOperator.MAX: return NumberComparatorExecuter.evaluate(result, NumberComparator.GREATER, value1) == BooleanOrUndef.TRUE ? result : undefined;
            case NumericalOperator.MEAN: return NumericalOperatorExecuter.evaluate(NumericalOperatorExecuter.evaluate(2.0, NumericalOperator.TIMES, result), NumericalOperator.MINUS, value1); //2 * result - value1;
            case NumericalOperator.UNION: return result;
            case NumericalOperator.INTERSECTION: return result;
        }
    }

    getInverseNumerical1(result: number | Range, values: CriteriaValues): number | Range | undefined {
        const value0 = this.numerical0.getValue(values);
        if (value0 == undefined) {
            return undefined;
        }
        switch (this.operator) {
            case NumericalOperator.PLUS: return NumericalOperatorExecuter.evaluate(result, NumericalOperator.MINUS, value0);
            case NumericalOperator.MINUS: return NumericalOperatorExecuter.evaluate(value0, NumericalOperator.MINUS, result);
            case NumericalOperator.TIMES: return NumericalOperatorExecuter.evaluate(result, NumericalOperator.DIVIDED_BY, value0);
            case NumericalOperator.DIVIDED_BY: return NumericalOperatorExecuter.evaluate(value0, NumericalOperator.DIVIDED_BY, result);
            case NumericalOperator.POWER: return NumericalOperatorExecuter.evaluate(value0, NumericalOperator.LOG, result); //Math.log(result) / Math.log(value0);
            case NumericalOperator.LOG: return NumericalOperatorExecuter.evaluate(value0, NumericalOperator.POWER, result); //value0 ** result;
            case NumericalOperator.MIN: return NumberComparatorExecuter.evaluate(result, NumberComparator.LESS, value0) == BooleanOrUndef.TRUE ? result : undefined;
            case NumericalOperator.MAX: return NumberComparatorExecuter.evaluate(result, NumberComparator.GREATER, value0) == BooleanOrUndef.TRUE ? result : undefined;
            case NumericalOperator.MEAN: return NumericalOperatorExecuter.evaluate(NumericalOperatorExecuter.evaluate(2.0, NumericalOperator.TIMES, result), NumericalOperator.MINUS, value0); //2 * result - value0;
            case NumericalOperator.UNION: return result;
            case NumericalOperator.INTERSECTION: return result;
        }
    }

    override getDependingCriteria(values: CriteriaValues): Criterion[] {
        const gatherCriteria = this.numerical0.getDependingCriteria(values);
        for (let criterion of this.numerical1.getDependingCriteria(values)) {
            if (!gatherCriteria.includes(criterion)) {
                gatherCriteria.push(criterion)
            }
        }
        return gatherCriteria;
    }


    //TODO: ggf spaeter auch mehrzeilig machen fuer verschachtelte Funktionen analog zu LogicalCondition

    override toString(): string {
        return (this.numerical0 instanceof NumericalFunction ? "(" : "") + this.numerical0.toString() + (this.numerical0 instanceof NumericalFunction ? ")" : "") + " " + NumericalOperatorUtil.asSymbol(this.operator) + " " + (this.numerical1 instanceof NumericalFunction ? "(" : "") + (this.numerical1.toString()) + (this.numerical1 instanceof NumericalFunction ? ")" : "");
    }

    /**
     * 
     * @param values 
     *      current criteria values
     * @param onlyMinOrMax 
     *      false: only min; true: only max; undefined: all;
     * @returns 
     *      html string describing the reason(s), typically the conditions, why this numerical has this value for these criteria values.
     */
    override conditionAsColorCodedHtml(values: CriteriaValues, onlyMinOrMax?: boolean): string {
        return this.toString() + " (= " + this.getValue(values) + ")";
    }
}

export enum NumberComparator {
    LESS = "LESS",
    LESSEQUAL = "LESSEQUAL",
    EQUAL = "EQUAL",
    GREATEREQUAL = "GREATEREQUAL",
    GREATER = "GREATER",
    IS_SET = "IS_SET"
}

export class NumberComparatorUtil {
    public static asSymbol(numberComparator: NumberComparator): string {
        switch (numberComparator) {
            case NumberComparator.LESS: return "<";
            case NumberComparator.LESSEQUAL: return "\u2264";
            case NumberComparator.EQUAL: return "=";
            case NumberComparator.GREATEREQUAL: return "\u2265";
            case NumberComparator.GREATER: return ">";
            case NumberComparator.IS_SET: return "ist gesetzt";
        }
    }

    public static getInverse(numberComparator: NumberComparator): NumberComparator {
        switch (numberComparator) {
            case NumberComparator.LESS: return NumberComparator.GREATER;
            case NumberComparator.LESSEQUAL: return NumberComparator.GREATEREQUAL;
            case NumberComparator.EQUAL: return NumberComparator.EQUAL;
            case NumberComparator.GREATEREQUAL: return NumberComparator.LESSEQUAL;
            case NumberComparator.GREATER: return NumberComparator.GREATER;
            case NumberComparator.IS_SET: return NumberComparator.IS_SET;
        }
    }
}

class NumberComparatorExecuter {
    /**
     * 
     * @param operator 
     * @param val0 
     * @param val1 
     *   is ignored for operator == NumberComparator.IS_SET
     * @returns 
     */
    public static evaluate(val0: number | Range | undefined, operator: NumberComparator, val1: number | Range | undefined): BooleanOrUndef {
        if (operator == NumberComparator.IS_SET) {
            return val0 == undefined ? BooleanOrUndef.UNDEFINED : BooleanOrUndef.TRUE;
        }
        if (val0 == undefined || val1 == undefined) {
            return BooleanOrUndef.UNDEFINED;
        }

        const val0low = val0 instanceof Range ? val0.start : val0;
        const val0high = val0 instanceof Range ? val0.end : val0;
        const val1low = val1 instanceof Range ? val1.start : val1;
        const val1high = val1 instanceof Range ? val1.end : val1;

        if (operator == NumberComparator.LESS) {
            return val0high < val1low ? BooleanOrUndef.TRUE : val0low >= val1high ? BooleanOrUndef.FALSE : BooleanOrUndef.UNDEFINED;
        }
        else if (operator == NumberComparator.LESSEQUAL) {
            return val0high <= val1low ? BooleanOrUndef.TRUE : val0low > val1high ? BooleanOrUndef.FALSE : BooleanOrUndef.UNDEFINED;
        }
        else if (operator == NumberComparator.EQUAL) {
            return (val0low == val0high && val1low == val1high && val0low == val1low) ? BooleanOrUndef.TRUE :
                (NumberComparatorExecuter.evaluate(val0, NumberComparator.LESS, val1) == BooleanOrUndef.TRUE
                    || NumberComparatorExecuter.evaluate(val0, NumberComparator.GREATER, val1) == BooleanOrUndef.TRUE) ?
                    BooleanOrUndef.FALSE : BooleanOrUndef.UNDEFINED;
        }
        else if (operator == NumberComparator.GREATEREQUAL) {
            return val0low >= val1high ? BooleanOrUndef.TRUE : val0high < val1low ? BooleanOrUndef.FALSE : BooleanOrUndef.UNDEFINED;
        }
        else if (operator == NumberComparator.GREATER) {
            return val0low > val1high ? BooleanOrUndef.TRUE : val0high <= val1low ? BooleanOrUndef.FALSE : BooleanOrUndef.UNDEFINED;
        }
        return BooleanOrUndef.UNDEFINED;
    }
}

export enum LogicalOperator {
    AND = "AND",
    OR = "OR",
    XOR = "XOR",
    NOT = "NOT",
    ONE_TRUE = "ONE_TRUE",
    TWO_TRUE = "TWO_TRUE",
    THREE_TRUE = "THREE_TRUE",
    FOUR_TRUE = "FOUR_TRUE",
    FIVE_TRUE = "FIVE_TRUE",
    IS_DEFINED = "IS_DEFINED",
    IS_UNDEFINED = "IS_UNDEFINED"
}

class LogicalOperatorUtil {
    public static toString(logicalOperator: LogicalOperator): string {
        switch (logicalOperator) {
            case LogicalOperator.AND: return "and";
            case LogicalOperator.OR: return "or";
            case LogicalOperator.XOR: return "either or";
            case LogicalOperator.NOT: return "not";
            case LogicalOperator.ONE_TRUE: return "one true";
            case LogicalOperator.TWO_TRUE: return "two true";
            case LogicalOperator.THREE_TRUE: return "three true";
            case LogicalOperator.FOUR_TRUE: return "four true";
            case LogicalOperator.FIVE_TRUE: return "five true";
            case LogicalOperator.IS_DEFINED: return "is defined";
            case LogicalOperator.IS_UNDEFINED: return "is undefined";
        }
        return "";
    }
}

class LogicalOperatorExecuter {
    /**
     * 
     * @param operator 
     * @param values should contain the conditions that are compared (their results as booleans).
     * Note that for NOT, IS_DEFINED, and IS_UNDEFINED only the first entry is checked,
     * for XOR (exclusive or a.k.a. either or), only the first two entries are compared,
     * for the others, all entries are checked and an arbitrary number of entries is possible
     * @returns 
     */
    public static evaluate(operator: LogicalOperator, values: BooleanOrUndef[]): BooleanOrUndef {
        if (operator == LogicalOperator.NOT) {
            return values[0] == BooleanOrUndef.TRUE ? BooleanOrUndef.FALSE : values[0] == BooleanOrUndef.FALSE ? BooleanOrUndef.TRUE : BooleanOrUndef.UNDEFINED;
        }
        else if (operator == LogicalOperator.IS_DEFINED) {
            return values[0] == BooleanOrUndef.UNDEFINED ? BooleanOrUndef.FALSE : BooleanOrUndef.TRUE;
        }
        else if (operator == LogicalOperator.IS_UNDEFINED) {
            return values[0] == BooleanOrUndef.UNDEFINED ? BooleanOrUndef.TRUE : BooleanOrUndef.FALSE;
        }
        else if (operator == LogicalOperator.XOR) {
            if (values[0] == BooleanOrUndef.UNDEFINED || values[1] == BooleanOrUndef.UNDEFINED) {
                return BooleanOrUndef.UNDEFINED;
            }
            return (values[0] == BooleanOrUndef.TRUE && values[1] == BooleanOrUndef.FALSE)
                || (values[0] == BooleanOrUndef.FALSE && values[1] == BooleanOrUndef.TRUE)
                ? BooleanOrUndef.TRUE : BooleanOrUndef.FALSE;
        }

        var countUndefs = 0;
        for (const v of values) {
            if (v == BooleanOrUndef.UNDEFINED) {
                ++countUndefs;
            }
        }

        var countTrues = 0;
        for (const v of values) {
            if (v == BooleanOrUndef.TRUE) {
                ++countTrues;
            }
        }

        if (operator == LogicalOperator.AND) {
            return countTrues + countUndefs < values.length ? BooleanOrUndef.FALSE : countTrues >= values.length ? BooleanOrUndef.TRUE : BooleanOrUndef.UNDEFINED;
        }
        else if (operator == LogicalOperator.OR || operator == LogicalOperator.ONE_TRUE) {
            return countTrues >= 1 ? BooleanOrUndef.TRUE : countTrues + countUndefs >= 1 ? BooleanOrUndef.UNDEFINED : BooleanOrUndef.FALSE;
        }
        else if (operator == LogicalOperator.TWO_TRUE) {
            return countTrues >= 2 ? BooleanOrUndef.TRUE : countTrues + countUndefs >= 2 ? BooleanOrUndef.UNDEFINED : BooleanOrUndef.FALSE;
        }
        else if (operator == LogicalOperator.THREE_TRUE) {
            return countTrues >= 3 ? BooleanOrUndef.TRUE : countTrues + countUndefs >= 3 ? BooleanOrUndef.UNDEFINED : BooleanOrUndef.FALSE;
        }
        else if (operator == LogicalOperator.FOUR_TRUE) {
            return countTrues >= 4 ? BooleanOrUndef.TRUE : countTrues + countUndefs >= 4 ? BooleanOrUndef.UNDEFINED : BooleanOrUndef.FALSE;
        }
        else if (operator == LogicalOperator.FIVE_TRUE) {
            return countTrues >= 5 ? BooleanOrUndef.TRUE : countTrues + countUndefs >= 5 ? BooleanOrUndef.UNDEFINED : BooleanOrUndef.FALSE;
        }
        return BooleanOrUndef.UNDEFINED;
    }
}

@JsonTypeInfo({ use: JsonTypeInfoId.NAME, include: JsonTypeInfoAs.PROPERTY, property: "@type" })
@JsonSubTypes({
    types: [
        { class: () => NumericalCondition, name: 'numerical' },
        { class: () => CategoricalCondition, name: 'categorical' },
        { class: () => LogicalCondition, name: 'logical' },
        { class: () => StateCondition, name: 'state' },
        { class: () => EditorCategoricalCondition, name: 'editorcategorical' },
        { class: () => EditorNumericalCondition, name: 'editornumerical' },
        { class: () => EditorLogicalCondition, name: 'editorlogical' },
        { class: () => EditorStateCondition, name: 'editorstate' }
    ]
})
//should be used as if it was abstract and should not be instantiated; it's not made abstract because then we cannnot set
//"@JsonProperty() @JsonClassType({type: () => [Condition]})" and that causes problems for deserialization
export class Condition {
    static readonly COLOR_FALSE = "red";
    static readonly COLOR_UNDEFINED = "gray";
    static readonly COLOR_TRUE = "green";

    constructor() {

    }
    evaluate(values: CriteriaValues): BooleanOrUndef {
        return BooleanOrUndef.UNDEFINED;
    }

    toString(): string {
        return "";
    }

    /**
     * 
     * @param values
     *   values according to which the truth evaluation for the color coding is performed
     * @returns 
     *   the same value as toString() but with addtional color coding in html on which
     *   of the (sub)conditions are true (green), open (black/gray), or false (red)
     */
    toColorCodedHtmlString(values: CriteriaValues): string {
        return "<div style=\"color:" + this.getColorCode(values) + "; display:inline\">" + this.toString() + "</div>";
    }

    getColorCode(values: CriteriaValues): string {
        var colorCode = Condition.COLOR_UNDEFINED;
        if (this.evaluate(values) == BooleanOrUndef.TRUE) {
            colorCode = Condition.COLOR_TRUE;
        }
        else if (this.evaluate(values) == BooleanOrUndef.FALSE) {
            colorCode = Condition.COLOR_FALSE;
        }
        return colorCode;
    }

    getDependingCriteria(criteriaValues: CriteriaValues): Criterion[] {
        if (this instanceof LogicalCondition) {
            const gatherCriteria: Criterion[] = [];
            for (let subCondition of this.conditions) {
                for (let criterion of subCondition.getDependingCriteria(criteriaValues)) {
                    if (!gatherCriteria.includes(criterion)) {
                        gatherCriteria.push(criterion);
                    }
                }
            }
            return gatherCriteria;
        }
        else if (this instanceof StateCondition) {
            return this.state.condition.getDependingCriteria(criteriaValues);
        }
        else if (this instanceof CategoricalCondition) {
            return [this.criterion];
        }
        else if (this instanceof NumericalCondition) {
            return this.reference.getDependingCriteria(criteriaValues);
        }
        else {
            console.error("Condition of type " + this.constructor.name + " not included in method 'getContainedCriteria' of class 'Condition'!");
        }
        return [];
    }

    dependsOnCriterion(criterion: Criterion, criteriaValues: CriteriaValues): boolean {
        if (this instanceof LogicalCondition) {
            for (let subCondition of this.conditions) {
                if (subCondition.dependsOnCriterion(criterion, criteriaValues)) {
                    return true;
                }
            }
        }
        else if (this instanceof StateCondition) {
            //check if the state this condition refers to requires this criterion (via its internal condition recursively)
            if ( //condition.state.condition.evaluate(criteriaValues) != BooleanOrUndef.FALSE && ////JZ 2023/11/16: why do we need this additional check??? I think we also don't need criteriaValues as an input parameter then.
                this.state.condition.dependsOnCriterion(criterion, criteriaValues)) {
                return true;
            }
        }
        else if (this instanceof CategoricalCondition) {
            if (criterion == this.criterion) {
                return true;
            }
        }
        else if (this instanceof NumericalCondition) {
            return this.reference.getDependingCriteria(criteriaValues).includes(criterion);
        }
        else {
            console.error("Condition of type " + this.constructor.name + " not included in method 'containsCriterion' of class 'Condition'!");
        }
        return false;
    }
}

@JsonTypeName({ value: 'numerical' })
export class NumericalCondition extends Condition {
    @JsonProperty() @JsonClassType({ type: () => [Numerical] })
    reference: Numerical;
    @JsonProperty() @JsonClassType({ type: () => [String] })
    comparator: NumberComparator;
    @JsonProperty() @JsonClassType({ type: () => [Numerical] })
    thresholdNumerical: Numerical;

    constructor(reference: Numerical, threshold: number, comparator: NumberComparator) {
        super();
        this.reference = reference;
        this.thresholdNumerical = new Constant(threshold);
        this.comparator = comparator;
    }

    override evaluate(values: CriteriaValues): BooleanOrUndef {
        return NumberComparatorExecuter.evaluate(this.reference.getValue(values), this.comparator, this.thresholdNumerical.getValue(values));
    }

    override toString(): string {
        return this.reference.toString() + " " + NumberComparatorUtil.asSymbol(this.comparator) + (this.comparator == NumberComparator.IS_SET ? "" : " " + this.thresholdNumerical);
    }
}

@JsonTypeName({ value: 'categorical' })
export class CategoricalCondition extends Condition {
    @JsonProperty() @JsonClassType({ type: () => [Array, [String]] })
    equal: string[];
    @JsonProperty() @JsonClassType({ type: () => [CategoricalCriterion] })
    criterion: CategoricalCriterion;
    @JsonProperty() @JsonClassType({ type: () => [String] })
    dataSelection?: DataSelection;

    constructor(criterion: CategoricalCriterion, equal: string[], dataSelection?: DataSelection) {
        super();
        this.criterion = criterion;
        this.equal = equal;
        this.dataSelection = dataSelection;
    }

    override evaluate(values: CriteriaValues): BooleanOrUndef {
        if (values != undefined) {
            const currentValue = values.getCategorical(this.criterion, this.dataSelection);
            if (currentValue == undefined) {
                return BooleanOrUndef.UNDEFINED;
            }
            else if (Array.isArray(currentValue)) {
                if (currentValue.length == 0) {
                    //empty array is like undefined
                    return BooleanOrUndef.UNDEFINED;
                }
                var containedValues = 0;
                for (let v of currentValue) {
                    if (this.equal.includes(v)) {
                        ++containedValues;
                    }
                }
                return containedValues == 0 ? BooleanOrUndef.FALSE : containedValues == currentValue.length ? BooleanOrUndef.TRUE : BooleanOrUndef.UNDEFINED;
            }
            else { //is a single value (string)
                return this.equal.includes(currentValue) ? BooleanOrUndef.TRUE : BooleanOrUndef.FALSE;
            }
        }
        return BooleanOrUndef.UNDEFINED;
    }

    override toString(): string {
        var conditionString: string = (this.criterion ? this.criterion.name : "") + " \u2208 [";
        for (let entry of this.equal) {
            if (conditionString[conditionString.length - 1] != "[") {
                conditionString += ", ";
            }
            conditionString += entry;
        }
        conditionString += "]"
        return conditionString;
    }
}

@JsonTypeName({ value: 'logical' })
export class LogicalCondition extends Condition {
    @JsonProperty() @JsonClassType({ type: () => [Array, [Condition]] })
    conditions: Condition[];
    @JsonProperty() @JsonClassType({ type: () => [String] })
    operator: LogicalOperator;

    constructor(operator: LogicalOperator, conditions: Condition[]) {
        super();
        this.conditions = conditions;
        this.operator = operator;
    }

    override evaluate(values: CriteriaValues): BooleanOrUndef {
        const evaluatedSubConditions: BooleanOrUndef[] = [];
        for (let condition of this.conditions) {
            evaluatedSubConditions.push(condition.evaluate(values));
        }

        return LogicalOperatorExecuter.evaluate(this.operator, evaluatedSubConditions);
    }

    private toStringWithColorCodingIfValuesIsNotUndefined(values?: CriteriaValues): string {
        var conditionString: string = "";
        /*
            For better visualization, we use new lines and indentions if this logical condition contains logical (sub)conditions.
            If not, we put this expression into 1 line (using spaces instead)
        */
        var potentialNewLines: string = " ";
        var additionalIndent: boolean = false;
        for (let subcondition of this.conditions) {
            //for now: commented out to have for every argument in a logical condition a new line:
            // if (subcondition instanceof LogicalCondition) {
            potentialNewLines = "\n";
            additionalIndent = true;
            // }
        }
        for (let subcondition of this.conditions) {
            if (this.operator == LogicalOperator.NOT || this.operator == LogicalOperator.IS_DEFINED || this.operator == LogicalOperator.IS_UNDEFINED) {
                conditionString += LogicalOperatorUtil.toString(this.operator) + ":" + potentialNewLines;
            }
            else if (conditionString.length > 0) {
                conditionString += potentialNewLines + LogicalOperatorUtil.toString(this.operator) + potentialNewLines;
            }
            const subconditionString = values == undefined ? subcondition.toString() : subcondition.toColorCodedHtmlString(values);
            conditionString += subcondition instanceof LogicalCondition ? addIndentationToEveryLine(additionalIndent, "(" + subconditionString + ")") : subconditionString;
        }
        return conditionString;
    }

    override toString(): string {
        return this.toStringWithColorCodingIfValuesIsNotUndefined();
    }

    override toColorCodedHtmlString(values: CriteriaValues): string {
        return "<div style='color:" + this.getColorCode(values) + "'>" + this.toStringWithColorCodingIfValuesIsNotUndefined(values) + "</div>";
    }
}

function addIndentationToEveryLine(flag: boolean, text: string): string {
    if (flag && text.includes('\n')) {
        const allLines = text.split('\n');
        var extendedText = "";
        for (let line of allLines) {
            //in the first line we want one space less because we have an opening bracket that already has some width
            //also we need the other lines to end with a newline
            if (extendedText == "") {
                extendedText += "&nbsp;&nbsp;&nbsp;" + line;
            }
            else {
                extendedText += "\n&nbsp;&nbsp;&nbsp;&nbsp;" + line;
            }
        }
        return extendedText;
    }
    return text;
}

@JsonTypeName({ value: 'state' })
export class StateCondition extends Condition {
    @JsonProperty() @JsonClassType({ type: () => [State] })
    state: State;
    @JsonProperty() @JsonClassType({ type: () => [String] })
    equals: BooleanOrUndef;

    constructor(state: State, equals: BooleanOrUndef) {
        super();
        this.state = state;
        this.equals = equals;
    }

    override evaluate(values: CriteriaValues): BooleanOrUndef {
        const stateConfirmation: BooleanOrUndef = this.state.isConfirmed(values);
        return stateConfirmation == this.equals ? BooleanOrUndef.TRUE : stateConfirmation == BooleanOrUndef.UNDEFINED ? BooleanOrUndef.UNDEFINED : BooleanOrUndef.FALSE;
    }

    override toString(): string {
        return (this.equals == BooleanOrUndef.FALSE ? LogicalOperatorUtil.toString(LogicalOperator.NOT) + " " : (this.equals == BooleanOrUndef.UNDEFINED ? LogicalOperatorUtil.toString(LogicalOperator.IS_UNDEFINED) + " " : "")) + this.state.name;
    }
}

@JsonTypeName({ value: 'constant' })
export class Constant extends Numerical {
    @JsonProperty() @JsonClassType({ type: () => [Number] })
    value: number;

    constructor(value: number) {
        super();
        this.value = value;
    }

    override getValue(values: CriteriaValues): number | Range | undefined {
        return this.value;
    }

    override toString(): string {
        return "" + this.value;
    }
}

@JsonTypeName({ value: 'criterion' })
export class CriterionValue extends Numerical {
    @JsonProperty() @JsonClassType({ type: () => [NumericalCriterion] })
    criterion: NumericalCriterion;
    @JsonProperty() @JsonClassType({ type: () => [String] })
    dataSelection?: DataSelection;


    constructor(criterion: NumericalCriterion, dataSelection?: DataSelection) {
        super();
        this.criterion = criterion;
        this.dataSelection = dataSelection;
    }

    override getValue(values: CriteriaValues): Range {
        return values.getNumerical(this.criterion, this.dataSelection);
    }

    override getDependingCriteria(values: CriteriaValues): Criterion[] {
        return [this.criterion];
    }


    override toString(): string {
        return this.criterion.name;
    }

    /**
     * 
     * @param values 
     *      current criteria values
     * @param onlyMinOrMax 
     *      false: only min; true: only max; undefined: all;
     * @returns 
     *      html string describing the reason(s), typically the conditions, why this numerical has this value for these criteria values.
     */
    override conditionAsColorCodedHtml(values: CriteriaValues, onlyMinOrMax?: boolean): string {
        return "Wert von " + this.toString() + " (= " + this.getValue(values) + ")";
    }
}

export class CategoricalDependency {
    @JsonProperty() @JsonClassType({ type: () => [CategoricalCriterion] })
    criterion: CategoricalCriterion;
    @JsonProperty() @JsonClassType({ type: () => [Array, [ValueExclusion]] })
    valueExclusions: ValueExclusion[];

    constructor(criterion: CategoricalCriterion, valueExclusions: ValueExclusion[]) {
        this.criterion = criterion;
        this.valueExclusions = valueExclusions;
    }
}

/**
* CategoricalCriterionValue is identified by the name string (not the synonyms!)
*/
export class ValueExclusion {
    @JsonProperty() @JsonClassType({ type: () => [Array, [String]] })
    values: string[];
    @JsonProperty() @JsonClassType({ type: () => [Condition] })
    excludingCondition: Condition;

    constructor(values: string[], excludingCondition: Condition) {
        this.values = values;
        this.excludingCondition = excludingCondition;
    }
}

export class NumericalDependency {
    @JsonProperty() @JsonClassType({ type: () => [NumericalCriterion] })
    criterion: NumericalCriterion;
    @JsonProperty() @JsonClassType({ type: () => [ConditionalNumerical] })
    conditionalNumerical: ConditionalNumerical;

    constructor(criterion: NumericalCriterion, conditionalNumerical: ConditionalNumerical) {
        this.criterion = criterion;
        this.conditionalNumerical = conditionalNumerical;
    }
}

@JsonTypeName({ value: 'conditional' })
export class ConditionalNumerical extends Numerical {
    //conditions are orderd by priority -> they are evaluated by insertion order and if is true, the numerical value is returned; otherwise the next condition is evaluated
    @JsonProperty() @JsonClassType({ type: () => [Array, [ValueCondition]] })
    conditions2Numericals: ValueCondition[];
    @JsonProperty() @JsonClassType({ type: () => [Numerical] })
    defaultValue?: Numerical;

    constructor(conditions2Numericals: ValueCondition[], defaultValue?: Numerical) {
        super();
        this.conditions2Numericals = conditions2Numericals;
        this.defaultValue = defaultValue;
    }

    override getValue(values: CriteriaValues): number | Range | undefined {
        const resultingValues: (number | Range)[] = [];
        //find all relevant numericals and get their values
        for (let valueCondition of this.getRelevantValueConditions(values)) {
            const value = valueCondition.numerical.getValue(values);
            if (value != undefined) {
                resultingValues.push(value);
            }
        }
        //find the union of the resulting values
        var result: number | Range | undefined = undefined;
        for (let value of resultingValues) {
            if (result == undefined) {
                result = value;
            }
            else {
                result = NumericalOperatorExecuter.evaluate(result, NumericalOperator.UNION, value) ?? result;
            }
        }
        return result;
    }

    private getRelevantValueConditions(values: CriteriaValues, ignoreUndefinedOnes?: boolean): ValueCondition[] {
        //first check if one is completely true
        //otherwise collect the ones that can be true + default value
        const partiallyRelevant = [];
        for (let conditionWithNumerical of this.conditions2Numericals) {
            const fulfilled = conditionWithNumerical.condition.evaluate(values);
            if (fulfilled == BooleanOrUndef.TRUE) {
                return [conditionWithNumerical];
            }
            else if (fulfilled == BooleanOrUndef.UNDEFINED && (ignoreUndefinedOnes == undefined || !ignoreUndefinedOnes)) {
                partiallyRelevant.push(conditionWithNumerical);
            }
        }
        if (this.defaultValue != undefined) {
            partiallyRelevant.push(new ValueCondition(new LogicalCondition(LogicalOperator.AND, []), this.defaultValue));
        }
        return partiallyRelevant;
    }

    override getDependingCriteria(values: CriteriaValues): Criterion[] {
        const dependingCriteria: Criterion[] = [];
        for (let valueCondition of this.getRelevantValueConditions(values, true)) {
            for (let criterion of valueCondition.condition.getDependingCriteria(values)) {
                if (!dependingCriteria.includes(criterion)) {
                    dependingCriteria.push(criterion);
                }
            }
            for (let criterion of valueCondition.numerical.getDependingCriteria(values)) {
                if (!dependingCriteria.includes(criterion)) {
                    dependingCriteria.push(criterion);
                }
            }
        }
        return dependingCriteria;
    }

    override toString(): string {
        return "[conditionalNumerical=" + this.conditions2Numericals + (this.defaultValue != undefined ? ", default=" + this.defaultValue : "") + "]";
    }

    /**
     * 
     * @param values 
     *      current criteria values
     * @param onlyMinOrMax 
     *      false: only min; true: only max; undefined: all;
     * @returns 
     *      html string describing the reason(s), typically the conditions, why this numerical has this value for these criteria values.
     */
    override conditionAsColorCodedHtml(values: CriteriaValues, onlyMinOrMax?: boolean): string {
        var answer = "";

        var minOrMaxValue: number | Range = onlyMinOrMax ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
        var minOrMaxEntry: ValueCondition | undefined;
        const relevantNumericals = this.getRelevantValueConditions(values).map((valueCondition: ValueCondition) => { return valueCondition.numerical });
        for (let conditionWithNumerical of this.conditions2Numericals) {
            if (!relevantNumericals.includes(conditionWithNumerical.numerical)) {
                continue;
            }
            const fulfilled = conditionWithNumerical.condition.evaluate(values);
            if (fulfilled == BooleanOrUndef.TRUE) {
                const value = conditionWithNumerical.numerical.getValue(values);
                if (value != undefined) {
                    if (onlyMinOrMax == undefined) {
                        answer += (answer.length > 0 ? "<br><br>" : "") + conditionWithNumerical.numerical.toString()
                            + (conditionWithNumerical.numerical instanceof Constant ? "" : " (= " + value + ")") + " wegen<br>"
                            + conditionWithNumerical.condition.toColorCodedHtmlString(values);
                    }
                    else if (onlyMinOrMax == false && (value instanceof Range ? value.start : value) < (minOrMaxValue instanceof Range ? minOrMaxValue.end : minOrMaxValue)) {
                        minOrMaxValue = value;
                        minOrMaxEntry = conditionWithNumerical;
                    }
                    else if (onlyMinOrMax == true && (value instanceof Range ? value.end : value) > (minOrMaxValue instanceof Range ? minOrMaxValue.end : minOrMaxValue)) {
                        minOrMaxValue = value;
                        minOrMaxEntry = conditionWithNumerical;
                    }
                }
            }
        }
        if (onlyMinOrMax != undefined && minOrMaxEntry != undefined) {
            answer += minOrMaxEntry.numerical.toString()
                + (minOrMaxEntry.numerical instanceof Constant ? "" : " (= " + minOrMaxValue + ")") + " wegen<br>"
                + minOrMaxEntry.condition.toColorCodedHtmlString(values);
        }

        if (answer.length == 0) {
            if (this.defaultValue != undefined) {
                answer = this.defaultValue.conditionAsColorCodedHtml(values);
            }
            else {
                answer = "-- keiner --";
            }
        }

        return answer;
    }
}

export class ValueCondition {
    @JsonProperty() @JsonClassType({ type: () => [Condition] })
    condition: Condition;
    @JsonProperty() @JsonClassType({ type: () => [Numerical] })
    numerical: Numerical;

    constructor(condition: Condition, numerical: Numerical) {
        this.condition = condition;
        this.numerical = numerical;
    }
}

@JsonTypeName({ value: 'state' })
export class StateValue extends Numerical {
    @JsonProperty() @JsonClassType({ type: () => [State] })
    state: State;

    constructor(state: State) {
        super();
        this.state = state;
    }

    override getValue(values: CriteriaValues): number | Range | undefined {
        return this.state.getValue(values);
    }

    override getDependingCriteria(values: CriteriaValues): Criterion[] {
        return this.state.numerical?.getDependingCriteria(values) ?? [];
    }


    override toString(): string {
        return this.state.name;
    }

    /**
     * 
     * @param values 
     *      current criteria values
     * @param onlyMinOrMax 
     *      false: only min; true: only max; undefined: all;
     * @returns 
     *      html string describing the reason(s), typically the conditions, why this numerical has this value for these criteria values.
     */
    override conditionAsColorCodedHtml(values: CriteriaValues, onlyMinOrMax?: boolean): string {
        return "Wert von " + this.toString() + " (= " + this.getValue(values) + ")";
    }
}

@JsonTypeName({ value: 'stategroup' })
export class StateGroupValue extends Numerical {
    @JsonProperty() @JsonClassType({ type: () => [StateGroup] })
    group: StateGroup;

    constructor(group: StateGroup) {
        super();
        this.group = group;
    }

    override getValue(values: CriteriaValues): number | Range | undefined {
        return this.group.getValue(values);
    }

    override getDependingCriteria(values: CriteriaValues): Criterion[] {
        const dependingCriteria: Criterion[] = [];
        for (let state of this.group.states) {
            if (state.numerical != undefined) {
                for (let criterion of state.numerical.getDependingCriteria(values)) {
                    if (!dependingCriteria.includes(criterion)) {
                        dependingCriteria.push(criterion);
                    }
                }
            }
        }
        return dependingCriteria;
    }


    override toString(): string {
        return (this.group.groupValueName != undefined && this.group.groupValueName.length > 0) ? this.group.groupValueName :
            this.group.name.length > 0 ? this.group.name :
                this.group.states.length == 1 ? this.group.states[0].name :
                    ("[" + this.group.states + "]");
    }

    /**
     * 
     * @param values 
     *      current criteria values
     * @param onlyMinOrMax 
     *      false: only min; true: only max; undefined: all;
     * @returns 
     *      html string describing the reason(s), typically the conditions, why this numerical has this value for these criteria values.
     */
    override conditionAsColorCodedHtml(values: CriteriaValues, onlyMinOrMax?: boolean): string {
        return "Wert von " + this.toString() + " (= " + this.getValue(values) + ")";
    }
}

@JsonIgnoreProperties({ value: ['stateGroup'] })
@JsonIdentityInfo({ generator: ObjectIdGenerator.IntSequenceGenerator, property: "@id" })
export class State extends Named {
    @JsonProperty() @JsonClassType({ type: () => [Condition] })
    condition: Condition;
    @JsonProperty() @JsonClassType({ type: () => [Numerical] })
    numerical?: Numerical;

    //for internal use to be able to answer whether this state is confirmed. This value is set when initializing a state group by the state group. Hence, we can safely assume that this value is set (unless this states appears only outside a state group)
    public stateGroup?: StateGroup;

    constructor(name: string, description: string | ConditionalString, condition: Condition, numerical?: Numerical) {
        super(name, description);
        this.condition = condition;
        this.numerical = numerical;
    }

    /**
     * Depends on the state group containing this state.
     * 
     * @param values 
     * @returns 
     *      If this state is confirmed -> BooleanOrUndef.TRUE;
     *      If it can still be confirmed but is not confirmed currently -> BooleanOrUndef.UNDEFINED;
     *      If it cannot be confirmed any more, i.e., its condition evaluates to false -> BooleanOrUndef.FALSE;
     */
    public isConfirmed(values: CriteriaValues): BooleanOrUndef {
        const evalResult = this.condition.evaluate(values);
        if (this.stateGroup == undefined || this.stateGroup.stateConfirmation == StateConfirmation.ALL_CONFIRMED || evalResult == BooleanOrUndef.FALSE) {
            return evalResult;
        }
        //go through states in the state group and check if they are confirmed; we know that the evalResult of this state is TRUE or UNDEFINED
        for (let stateByPriority of this.stateGroup.statesByPriority ?? this.stateGroup.states) {
            //we consider this state
            if (stateByPriority == this) {
                return evalResult;
            }
            //we consider a different state with higher priority
            else {
                const evalOfOther = stateByPriority.condition.evaluate(values);
                if (evalOfOther == BooleanOrUndef.TRUE) {
                    return BooleanOrUndef.FALSE;
                }
                else if (evalOfOther == BooleanOrUndef.UNDEFINED && this.stateGroup.stateConfirmation == StateConfirmation.STRICT_BY_PRIORITY) {
                    return BooleanOrUndef.UNDEFINED;
                }
            }
        }
        return evalResult; //this line should never be reached
    }

    public getValue(values?: CriteriaValues): number | Range | undefined {
        if (this.numerical != undefined) {
            return this.numerical.getValue(values ?? new CriteriaValues());
        }
        return undefined;
    }


    /**
     * 
     * @param decimalPrecision 
     *      number of digits behind the decimal separator (excluding leading 0s)
     */
    public getRoundedValue(values?: CriteriaValues, decimalPrecision?: number) {
        if (this.numerical != undefined) {
            return this.numerical.getRoundedValue(values ?? new CriteriaValues(), decimalPrecision ?? Constants.ROUNDING_DECIMAL_PRECISION);
        }
        return undefined;
    }
}

/**
* Class made to group similar criteria together.
* This is kind of tags for criteria (similar to tags for state groups),
* but the difference is that every criterion belongs to at most one CriterionGroup (instead of possibly multiple tags).
* You can also use the "empty" CriterionGroup if you use an empty string for the name and the description.
* CriterionGroups are currently only used for criteriaByDisplayOrder in Guideline.
*/
export class CriterionGroup extends Named {
    @JsonProperty() @JsonClassType({ type: () => [Array, [NumericalOrCategoricalCriterion]] })
    criteria: NumericalOrCategoricalCriterion[];

    @JsonProperty() @JsonClassType({ type: () => [Icon] })
    icon?: Icon;

    constructor(name: string, description: string | ConditionalString, criteria: NumericalOrCategoricalCriterion[], icon?: Icon) {
        super(name, description);
        this.criteria = criteria;
        this.icon = icon;
    }

    public includes(criterion: Criterion): boolean {
        for (let criterionWrapper of this.criteria) {
            if (criterionWrapper.getCriterion() == criterion) {
                return true;
            }
        }
        return false;
    }
}

export enum StateConfirmation {
    /**
     * Is the default value. It means that in a group, the states are checked strictly by priority:
     * as long as the state with the highest priority can still be true *is UNDEFINED), no other state
     * will be confirmed (even though its condition may evaluate to true).
     * Only if it cannot be true any more (FALSE) the state with the second highest priority is checked and so on.
     */
    STRICT_BY_PRIORITY = "STRICT_BY_PRIORITY",
    /**
     * Among all states that evaluate to TRUE, the one with the highest priority is the currently confirmed state.
     * That may mean that with inserting more information, a state with higher priority may become true and replaceses
     * another state with lower priority as confirmed state.
     * But a state may be earlier confirmed than with STRICT_BY_PRIORITY
     */
    CURRENTLY_CONFIRMED = "CURRENTLY_CONFIRMED",
    /**
     * All states that evaluate to TRUE are corrently confirmed states.
     */
    ALL_CONFIRMED = "ALL_CONFIRMED",
}

export class StateConfirmationUtil {
    public static toString(stateConfirmation: StateConfirmation): string {
        switch (stateConfirmation) {
            case StateConfirmation.STRICT_BY_PRIORITY: return "einer streng nach Priorität";
            case StateConfirmation.CURRENTLY_CONFIRMED: return "gerade bestätigter mit höchster Priorität";
            case StateConfirmation.ALL_CONFIRMED: return "alle gerade bestätigten";
        }
        return "";
    }
}

export class Icon {
    @JsonProperty() @JsonClassType({ type: () => [String] })
    path: string;

    constructor(path: string) {
        this.path = path;
    }
}

@JsonIdentityInfo({ generator: ObjectIdGenerator.IntSequenceGenerator, property: "@id" })
export class Tag extends Named {
    @JsonProperty() @JsonClassType({ type: () => [Tag] })
    parentTag?: Tag;

    @JsonProperty() @JsonClassType({ type: () => [Icon] })
    icon?: Icon;

    constructor(name: string, description: string | ConditionalString, parentTag?: Tag, icon?: Icon) {
        super(name, description);
        this.parentTag = parentTag;
        this.icon = icon;
    }

    public getLongName(): string {
        if (this.parentTag == undefined) {
            return this.name;
        }
        return this.parentTag.getLongName() + " / " + this.name;
    }
}

export interface Taggable {
    tags?: Tag[];
}

export interface Referencable {
    referenceID?: string;
}

export class StateGroup extends Named implements Taggable, Referencable {
    /**
     * states are sorted in the order they are shown to the user;
     * so this can also be seen as the display order of the states
     */
    @JsonProperty() @JsonClassType({ type: () => [Array, [State]] })
    states: State[];
    /**
     * this array should contain all states specified in the variable states or may be empty.
     * then the order from the variable states is taken also as a priority order.
     * priority means the order in which the states are checked.
     * if more than one state is true at a time, the first of them
     * within this array is (the only) true state.
     */
    @JsonProperty() @JsonClassType({ type: () => [Array, [State]] })
    statesByPriority?: State[];
    @JsonProperty() @JsonClassType({ type: () => [String] })
    visibility: Visibility;
    @JsonProperty() @JsonClassType({ type: () => [String] })
    stateConfirmation: StateConfirmation;
    @JsonProperty() @JsonClassType({ type: () => [String] })
    groupValueName?: string;
    @JsonProperty() @JsonClassType({ type: () => [Array, [Tag]] })
    tags?: Tag[];
    @JsonProperty() @JsonClassType({ type: () => [Boolean] })
    hideGroupName?: boolean;
    @JsonProperty() @JsonClassType({ type: () => [String] })
    referenceID?: string;

    constructor(name: string, description: string | ConditionalString, visibility: Visibility, states: State[], statesByPriority?: State[], stateConfirmation?: StateConfirmation, groupValueName?: string, tags?: (Tag | string)[], hideGroupName?: boolean, referenceID?: string) {
        super(name, description);
        this.states = states;
        this.stateConfirmation = stateConfirmation == undefined ? StateConfirmation.STRICT_BY_PRIORITY : stateConfirmation;
        this.statesByPriority = statesByPriority;
        this.visibility = visibility;
        this.hideGroupName = hideGroupName;
        this.referenceID = referenceID;
        this.groupValueName = groupValueName;
        if (tags != undefined) {
            this.tags = [];
            for (let tag of tags) {
                if (tag instanceof Tag) {
                    this.tags.push(tag);
                }
                else {
                    this.tags.push(new Tag(tag, ""));
                }
            }
        }
        //for every state register this state group as "its" state group
        for (let state of this.states) {
            state.stateGroup = this;
        }
    }

    public stateConfirmationToString(): string {
        return StateConfirmationUtil.toString(this.stateConfirmation);
    }

    public visbilityToString(): string {
        return VisibilityUtils.toString(this.visibility);
    }

    public getStatesByPriority(): State[] {
        if (this.statesByPriority != undefined && this.statesByPriority.length > 0) {
            return this.statesByPriority;
        }
        return this.states;
    }

    public getValue(values?: CriteriaValues): number | Range | undefined {
        return this.getRelevantNumericalInternal(values ?? new CriteriaValues(), false, 0);
    }


    /**
     * 
     * @param decimalPrecision 
     *      number of digits behind the decimal separator (excluding leading 0s)
     */
    public getRoundedValue(values?: CriteriaValues, decimalPrecision?: number) {
        return this.getRelevantNumericalInternal(values ?? new CriteriaValues(), true, decimalPrecision ?? Constants.ROUNDING_DECIMAL_PRECISION);
    }

    public getStateRelevantForCurrentValue(values?: CriteriaValues) {
        if (values == undefined) {
            values = new CriteriaValues();
        }
        for (let state of this.getStatesByPriority()) {
            const stateIsConfirmed = state.isConfirmed(values);
            if (stateIsConfirmed == BooleanOrUndef.TRUE) {
                if (state.numerical != undefined) {
                    if (state.getValue(values) != undefined) {
                        return state;
                    }
                }

                if (this.stateConfirmation != StateConfirmation.ALL_CONFIRMED) {
                    return undefined;
                }
            }
            else if (stateIsConfirmed == BooleanOrUndef.UNDEFINED && this.stateConfirmation == StateConfirmation.STRICT_BY_PRIORITY) {
                return undefined;
            }
        }
        return undefined;
    }

    private getRelevantNumericalInternal(values: CriteriaValues, rounded: boolean, decimalPrecision: number): number | Range | undefined {
        return rounded ? this.getStateRelevantForCurrentValue(values)?.getRoundedValue(values, decimalPrecision) : this.getStateRelevantForCurrentValue(values)?.getValue(values);
    }
}

export class StateWithGroup {
    constructor(public state: State, public group: StateGroup) { }
}


/////////////
// Trial-specific things
/////////////
@JsonTypeInfo({ use: JsonTypeInfoId.NAME, include: JsonTypeInfoAs.PROPERTY, property: "@type" })
@JsonSubTypes({
    types: [
        { class: () => Trial, name: 'trial' },
        { class: () => Publication, name: 'publication' }
    ]
})
export class KnowledgeEntity extends Named implements Taggable, Referencable {
    @JsonProperty() @JsonClassType({ type: () => [Array, [Tag]] })
    tags?: Tag[];
    @JsonProperty() @JsonClassType({ type: () => [String] })
    mainFinding?: string;
    @JsonProperty() @JsonClassType({ type: () => [String] })
    referenceID?: string;

    constructor(name: string, description: string | ConditionalString, tags?: (Tag | string)[], referenceID?: string) {
        super(name, description);
        this.referenceID = referenceID;
        if (tags != undefined) {
            this.tags = [];
            for (let tag of tags) {
                if (tag instanceof Tag) {
                    this.tags.push(tag);
                }
                else {
                    this.tags.push(new Tag(tag, ""));
                }
            }
        }
    }
}


// @JsonProperty() @JsonClassType({type: () => [Number]})
//     year: number;
//     @JsonProperty() @JsonClassType({type: () => [StateGroup]})
//@JsonIgnoreProperties({value: ['number']})
@JsonTypeName({ value: 'trial' })
export class Trial extends KnowledgeEntity {
    @JsonProperty() @JsonClassType({ type: () => [Number] })
    startYear?: number;
    @JsonProperty() @JsonClassType({ type: () => [Publication] })
    mainPublication?: Publication;
    @JsonProperty() @JsonClassType({ type: () => [Array, [RegistryEntry]] })
    registryEntries?: RegistryEntry[];
    @JsonProperty() @JsonClassType({ type: () => [Array, [TrialArm]] })
    arms?: TrialArm[];
    @JsonProperty() @JsonClassType({ type: () => [Array, [TrialEndpoint]] })
    trialEndpoints: TrialEndpoint[];
    @JsonProperty() @JsonClassType({ type: () => [String] })
    prospectiveOrRetrospective?: TrialProspectiveorRetrospectiveInfo;
    @JsonProperty() @JsonClassType({ type: () => [String] })
    randomization?: TrialRandomizationInfo;
    @JsonProperty() @JsonClassType({ type: () => [String] })
    center?: TrialCenterInfo;
    @JsonProperty() @JsonClassType({ type: () => [String] })
    phase?: TrialPhaseInfo;
    @JsonProperty() @JsonClassType({ type: () => [Number] })
    totalNumberOfPatients?: number;
    @JsonProperty() @JsonClassType({ type: () => [Condition] })
    relevantForSituationCondition?: Condition;
    @JsonProperty() @JsonClassType({ type: () => [Condition] })
    mainCriteriaFulfilledCondition?: Condition;
    @JsonProperty() @JsonClassType({ type: () => [Condition] })
    allCriteriaFulfilledCondition?: Condition;
    @JsonProperty() @JsonClassType({ type: () => [String] })
    mainFigureLink?: string;
    @JsonProperty() @JsonClassType({ type: () => [String] })
    mainFigureCaption?: string;
    @JsonProperty() @JsonClassType({ type: () => [Array, [TrialSubGroup]] })
    subGroups?: TrialSubGroup[];


    constructor(name: string, description: string | ConditionalString, tags?: (Tag | string)[], referenceID?: string) {
        super(name, description, tags, referenceID);
        this.trialEndpoints = new Array();
        this.prospectiveOrRetrospective = TrialProspectiveorRetrospectiveInfo.UNKNOWN;
        this.randomization = TrialRandomizationInfo.UNKNOWN;
        this.center = TrialCenterInfo.UNKNOWN;
    }

    getColorCode(values: CriteriaValues): string {
        if (this.relevantForSituationCondition?.evaluate(values) == BooleanOrUndef.TRUE ||
            this.mainCriteriaFulfilledCondition?.evaluate(values) == BooleanOrUndef.TRUE ||
            this.allCriteriaFulfilledCondition?.evaluate(values) == BooleanOrUndef.TRUE) {
            return Condition.COLOR_TRUE;
        }
        if ((this.relevantForSituationCondition?.evaluate(values) == BooleanOrUndef.FALSE || this.relevantForSituationCondition == undefined) &&
            (this.relevantForSituationCondition?.evaluate(values) == BooleanOrUndef.FALSE || this.relevantForSituationCondition == undefined) &&
            (this.relevantForSituationCondition?.evaluate(values) == BooleanOrUndef.FALSE || this.relevantForSituationCondition == undefined)) {
            return Condition.COLOR_FALSE;
        }
        return Condition.COLOR_UNDEFINED;
    }
}

export enum TrialProspectiveorRetrospectiveInfo {
    PROSPECTIVE = "PROSPECTIVE",
    RETROSPECTIVE = "RETROSPECTIVE",
    UNKNOWN = "UNKNOWN"
}

export enum TrialRandomizationInfo {
    RANDOMIZED = "RANDOMIZED",
    NOT_RANDOMIZED = "NOT RANDOMIZED",
    UNKNOWN = "UNKNOWN"
}

export enum TrialCenterInfo {
    SINGLECENTER = "SINGLECENTER",
    MULTICENTER = "MULTICENTER",
    UNKNOWN = "UNKNOWN"
}

export enum TrialPhaseInfo {
    I = "I",
    II = "II",
    III = "III",
    UNKNOWN = "UNKNOWN"
}


@JsonIdentityInfo({ generator: ObjectIdGenerator.IntSequenceGenerator, property: "@id" })
export class PublicationInfo {
    @JsonProperty() @JsonClassType({ type: () => [String] })
    title?: string;
    @JsonProperty() @JsonClassType({ type: () => [String] })
    abstract?: string;
    @JsonProperty() @JsonClassType({ type: () => [Array, [String]] })
    authors?: string[];
    @JsonProperty() @JsonClassType({ type: () => [Array, [String]] })
    language?: string[];
    @JsonProperty() @JsonClassType({ type: () => [String] })
    publicationLand?: string;
    @JsonProperty() @JsonClassType({ type: () => [String] })
    publicationDate?: string;
    @JsonProperty() @JsonClassType({ type: () => [String] })
    journalName?: string;
}


@JsonTypeName({ value: 'publication' })
export class Publication extends KnowledgeEntity {
    @JsonProperty() @JsonClassType({ type: () => [String] })
    title?: string;
    @JsonProperty() @JsonClassType({ type: () => [String] })
    abstract?: string;
    @JsonProperty() @JsonClassType({ type: () => [Array, [String]] })
    authors?: string[];
    @JsonProperty() @JsonClassType({ type: () => [Array, [String]] })
    language?: string[];
    @JsonProperty() @JsonClassType({ type: () => [String] })
    publicationLand?: string;
    @JsonProperty() @JsonClassType({ type: () => [String] })
    publicationDate?: string;
    @JsonProperty() @JsonClassType({ type: () => [String] })
    journalName?: string;
    @JsonProperty() @JsonClassType({ type: () => [String] })
    pmid?: string;
    @JsonProperty() @JsonClassType({ type: () => [Boolean] })
    extractDataFromPubMed?: boolean;
    @JsonProperty() @JsonClassType({ type: () => [String] })
    type?: string;
    @JsonProperty() @JsonClassType({ type: () => [PublicationInfo] })
    publicationInfo: PublicationInfo = new PublicationInfo();
    @JsonProperty() @JsonClassType({ type: () => [Condition] })
    relevantForSituationCondition?: Condition;

    //pubmedLink?: string
    //constructor(name: string, description: string, pubmedLink?: string){
    constructor(name: string, description: string | ConditionalString, pmid?: string, tags?: (Tag | string)[], referenceID?: string) {
        super(name, description, tags, referenceID);
        this.pmid = pmid
    }

    getColorCode(values: CriteriaValues): string {
        if (this.relevantForSituationCondition == undefined) {
            return Condition.COLOR_FALSE;
        }
        return this.relevantForSituationCondition.getColorCode(values);
    }
}

export class TrialArm {
    @JsonProperty() @JsonClassType({ type: () => [String] })
    description?: string;
    @JsonProperty() @JsonClassType({ type: () => [String] })
    shortName?: string;
    @JsonProperty() @JsonClassType({ type: () => [Number] })
    numberOfPatients?: number;

    constructor() {
    }
}


@JsonIgnoreProperties({ value: ['fulfilled'] })
export class TrialSubGroup extends Named {
    @JsonProperty() @JsonClassType({ type: () => [Number] })
    numberOfPatients?: number;
    @JsonProperty() @JsonClassType({ type: () => [Condition] })
    condition?: Condition;

    //Only needed for Graph and TrialEndnpointView
    fulfilled?: boolean;

    constructor() {
        super("", "");
    }
}




// @JsonIdentityInfo({generator: ObjectIdGenerator.IntSequenceGenerator, property: "@id"})
export class TrialEndpoint implements Taggable {
    @JsonProperty() @JsonClassType({ type: () => [String] })
    name: string;
    @JsonProperty() @JsonClassType({ type: () => [Array, [TrialEndpointValue]] })
    values: TrialEndpointValue[];
    @JsonProperty() @JsonClassType({ type: () => [String] })
    id?: string;
    @JsonProperty() @JsonClassType({ type: () => [Array, [String]] })
    comparableEndpoints?: string[];
    @JsonProperty() @JsonClassType({ type: () => [String] })
    negativeEndpoint?: string;
    @JsonProperty() @JsonClassType({ type: () => [Array, [Tag]] })
    tags?: Tag[];


    constructor(name: string, id?: string) {
        this.name = name;
        this.id = id;
        this.values = new Array();
    }
}



export class TrialEndpointValue {
    @JsonProperty() @JsonClassType({ type: () => [String] })
    endpointTime: string; //in Months; either number or "(none)"
    @JsonProperty() @JsonClassType({ type: () => [Array, [Number]] })
    endpointValues: number[]; //in Percentage
    @JsonProperty() @JsonClassType({ type: () => [TrialSubGroup] })
    associatedSubGroup?: TrialSubGroup; //is undefined for regular Endpoints
    @JsonProperty() @JsonClassType({ type: () => [Number] })
    pvalue?: number;

    @JsonProperty() @JsonClassType({ type: () => [String] })
    significant?: BooleanOrUndef;

    constructor(endpointTime: string, endpointValue: number[]) {
        this.endpointTime = endpointTime;
        this.endpointValues = endpointValue;
    }
}




export class RegistryEntry {
    @JsonProperty() @JsonClassType({ type: () => [String] })
    registryName: string;
    @JsonProperty() @JsonClassType({ type: () => [String] })
    link: string;
    @JsonProperty() @JsonClassType({ type: () => [String] })
    shortName?: string;

    constructor(registryName: string, link: string) {
        this.registryName = registryName;
        this.link = link;
    }
}



// end of trial objects



/**
* Guideline -- main object to be used outside
*/
//@JsonPropertyOrder({value: ['name', 'description', 'year', 'criteriaByPriority', 'criteriaByDisplayOrder', 'mainGroup', 'sideGroups', 'numericalDependencies', 'categoricalDependencies']})
@JsonPropertyOrder({ value: ['name', 'description', 'year', 'mainGroup', 'sideGroups', 'numericalDependencies', 'categoricalDependencies', 'criteriaByPriority', 'criteriaByDisplayOrder'] })
export class Guideline extends Named {
    @JsonProperty() @JsonClassType({ type: () => [Number] })
    year: number;
    @JsonProperty() @JsonClassType({ type: () => [StateGroup] })
    mainGroup: StateGroup | undefined;
    @JsonProperty() @JsonClassType({ type: () => [Array, [StateGroup]] })
    sideGroups: StateGroup[];

    /**
     * Optional value. If not provided, criteria need to be automatically extracted from the state groups in arbitrary priority order.
     * Priority means that dependencies are evaluated such that criteria with low priority is first changed to conform
     * with criteria with high priority.
     * Also criteria that is not used in a state (stands alone without affecting states), can be added here
     * (to be shown, the visibilty should be set to ALWAYS then).
     */
    @JsonProperty() @JsonClassType({ type: () => [Array, [NumericalOrCategoricalCriterion]] })
    criteriaByPriority?: NumericalOrCategoricalCriterion[];

    /**
     * Optional value. If not provided criteria fields are displayed by priority order (highest priority first)
     * and if this is also not provided in arbirtray order. Note that you can group criteria with the class
     * CriterionGroup.
     */
    @JsonProperty() @JsonClassType({ type: () => [Array, [CriterionGroup]] })
    criteriaByDisplayOrder?: CriterionGroup[];

    /**
     * optional conditions to exclude a value; the default is exclude never;
     * At most one entry per categorical criterion!
     */
    @JsonProperty() @JsonClassType({ type: () => [Array, [CategoricalDependency]] })
    categoricalDependencies: CategoricalDependency[] = [];

    /**
     * numerical criterion that may depend on other conditions;
     * At most one entry per numerical criterion!
     */
    @JsonProperty() @JsonClassType({ type: () => [Array, [NumericalDependency]] })
    numericalDependencies: NumericalDependency[] = [];

    /**
     * Array of Trials saved in the Guideline
     */
    @JsonProperty() @JsonClassType({ type: () => [Array, [KnowledgeEntity]] })
    knowledgeEntities: KnowledgeEntity[] = []; //to Knowledgeentities


    constructor(name: string, description: string | ConditionalString, year: number, mainGroup: StateGroup | undefined, sideGroups: StateGroup[], categoricalDependencies?: CategoricalDependency[], numericalDependencies?: NumericalDependency[], criteriaByPriority?: (NumericalOrCategoricalCriterion | Criterion)[], criteriaByDisplayOrder?: (CriterionGroup | NumericalOrCategoricalCriterion | Criterion)[], knowledgeEntities?: (KnowledgeEntity | Trial)[]) {
        super(name, description);
        this.year = year;
        this.mainGroup = mainGroup;
        this.sideGroups = sideGroups;
        if (criteriaByPriority != undefined) {
            this.criteriaByPriority = [];
            for (let criterion of criteriaByPriority) {
                this.criteriaByPriority.push(criterion instanceof NumericalOrCategoricalCriterion ? criterion : criterion.toWrapper());
            }
        }
        if (criteriaByDisplayOrder != undefined) {
            this.criteriaByDisplayOrder = [];
            for (let crit of criteriaByDisplayOrder) {
                this.criteriaByDisplayOrder.push(crit instanceof NumericalOrCategoricalCriterion ? new CriterionGroup("", "", [crit]) : crit instanceof Criterion ? new CriterionGroup("", "", [crit.toWrapper()]) : crit);
            }
        }
        if (categoricalDependencies != undefined) {
            this.categoricalDependencies = categoricalDependencies;
        }
        if (numericalDependencies != undefined) {
            this.numericalDependencies = numericalDependencies;
        }
        if (knowledgeEntities != undefined) {
            this.knowledgeEntities = knowledgeEntities;
        }

        //unify tags
        var groups = mainGroup == undefined ? [] : [mainGroup];
        if (sideGroups != undefined) groups = groups.concat(sideGroups);
        Guideline.unifyTags(groups);
        if (knowledgeEntities != undefined) Guideline.unifyTags(knowledgeEntities);
    }

    private static unifyTags(set: Taggable[]): void {
        const allTags: Tag[] = [];
        for (let taggable of set) {
            if (taggable.tags == undefined) continue;
            for (var i: number = 0; i < taggable.tags.length; i++) {
                var prevTag: Tag | undefined = undefined;
                var tagOrParent: Tag | undefined = taggable.tags[i];
                while (tagOrParent != undefined) {
                    const duplicate = Guideline.getIdenticalTagOrUndefined(allTags, tagOrParent);
                    if (duplicate != undefined) {
                        if (prevTag == undefined) {
                            // is a top-level tag of that taggable object -> replace it by its duplicate
                            taggable.tags[i] = duplicate;
                        }
                        else if (prevTag instanceof Tag) {
                            // some parent tag of the currently considered tag already exists -> replace it
                            prevTag.parentTag = duplicate;
                        }
                        break;
                    }
                    allTags.push(tagOrParent); //we have found a new tag
                    prevTag = tagOrParent;
                    tagOrParent = tagOrParent.parentTag;
                }
            }
        }
    }
    private static getIdenticalTagOrUndefined(tags: Tag[], tag: Tag) {
        for (let other of tags) {
            let tag0: Tag | undefined = other;
            let tag1: Tag | undefined = tag;
            //compare all parent levels if the tags are equal
            while (tag0 != undefined && tag1 != undefined) {
                //we ignore the descriptions because comparing two ConditionalStrings is difficult and actually we don't really use the description but only the name
                if (tag0.name != tag1.name) { // || tag0.description != tag1.description) {
                    break;
                }
                tag0 = tag0.parentTag;
                tag1 = tag1.parentTag;
            }
            if (tag0 == undefined && tag1 == undefined) {
                return other;
            }
        }
        return undefined;
    }
}







///////////////////
// special editor classes -- move later!!
///////////////////


@JsonTypeName({ value: 'editorlogical' })
@JsonIgnoreProperties({ value: ['number'] })
export class EditorLogicalCondition extends LogicalCondition {

    number: number;
    @JsonProperty() @JsonClassType({ type: () => [String] })
    color: string;
    @JsonProperty() @JsonClassType({ type: () => [Array, [Number]] })
    pos: number[];
    // public conditions: any[];


    constructor(number: number) {
        super(LogicalOperator.AND, []);
        this.conditions = [];
        this.number = number;
        this.color = "rgb(" + Math.random() * 255 + "," + Math.random() * 255 + "," + Math.random() * 255 + ")";
        this.pos = new Array(2);
        if (this.number == 0) //Sets Position for currentstate.condition to 500,0 (otherwise it could be undefined)
        {
            this.pos[0] = 500;
            this.pos[1] = 0;
        }
    }




    //SETTER and GETTER
    setnumber(number: number) {
        this.number = number;
    }
    getnumber() {
        return this.number;
    }
    setoperator(operator: LogicalOperator) {
        this.operator = operator;
    }
    getoperator() {
        return this.operator;
    }
    setpos(xpos: number, ypos: number) {
        this.pos[0] = xpos;
        this.pos[1] = ypos;
    }
    getpos() {
        return this.pos;
    }
    setColor(color: string) {
        this.color = color;
    }
    getColor() {
        return this.color;
    }
}





@JsonTypeName({ value: 'editorcategorical' })
@JsonIgnoreProperties({ value: ['number'] })
export class EditorCategoricalCondition extends CategoricalCondition {
    number: number;
    @JsonProperty() @JsonClassType({ type: () => [String] })
    color: string;
    @JsonProperty() @JsonClassType({ type: () => [Array, [Number]] })
    pos: number[];

    constructor(number: number, criterion: CategoricalCriterion, equal: string[]) {
        super(criterion, equal);
        this.number = number;
        this.color = "rgb(" + Math.random() * 255 + "," + Math.random() * 255 + "," + Math.random() * 255 + ")";
        this.pos = new Array(2);
    }


    setnumber(number: number) {
        this.number = number;
    }
    getnumber() {
        return this.number;
    }
    setpos(xpos: number, ypos: number) {
        this.pos[0] = xpos;
        this.pos[1] = ypos;
    }
    getpos() {
        return this.pos;
    }
    setColor(color: string) {
        this.color = color;
    }
    getColor() {
        return this.color;
    }
}



@JsonIgnoreProperties({ value: ['number'] })
export class EditorNumericalCondition extends NumericalCondition {
    number: number;
    @JsonProperty() @JsonClassType({ type: () => [String] })
    color: string;
    @JsonProperty() @JsonClassType({ type: () => [Array, [Number]] })
    pos: number[];

    constructor(number: number, criterionStateOrStateGroup: Numerical, threshold: number, comparator: NumberComparator) {

        if (criterionStateOrStateGroup instanceof NumericalCriterion) {
            super(new CriterionValue(criterionStateOrStateGroup), threshold, comparator);
        }
        else {
            if (criterionStateOrStateGroup instanceof State) {
                super(new StateValue(criterionStateOrStateGroup), threshold, comparator);
            }
            else
                if (criterionStateOrStateGroup instanceof StateGroup) {
                    super(new StateGroupValue(criterionStateOrStateGroup), threshold, comparator);
                } else {
                    { super(new Numerical(), threshold, comparator); }
                }
        }
        this.number = number;
        this.color = "rgb(" + Math.random() * 255 + "," + Math.random() * 255 + "," + Math.random() * 255 + ")";
        this.pos = new Array(2);
    }
    setnumber(number: number) {
        this.number = number;
    }
    getnumber() {
        return this.number;
    }
    setthreshold(threshold: number) {
        this.thresholdNumerical = new Constant(threshold); //TODO may be changed from number to (more general) Numerical
    }
    getthreshold(): number {
        let retVal = this.thresholdNumerical.getValue(new CriteriaValues);
        if (retVal instanceof Range || retVal === undefined) {
            retVal = 0;
        }
        return retVal;
    }
    setpos(xpos: number, ypos: number) {
        this.pos[0] = xpos;
        this.pos[1] = ypos;
    }
    getpos() {
        return this.pos;
    }
    setColor(color: string) {
        this.color = color;
    }
    getColor() {
        return this.color;
    }
}






@JsonIgnoreProperties({ value: ['number'] })
export class EditorStateCondition extends StateCondition {

    number: number;
    @JsonProperty() @JsonClassType({ type: () => [String] })
    color: string;
    @JsonProperty() @JsonClassType({ type: () => [Array, [Number]] })
    pos: number[];


    constructor(number: number, state: State, equals: BooleanOrUndef) {
        super(state, equals);
        this.number = number;
        this.color = "rgb(" + Math.random() * 255 + "," + Math.random() * 255 + "," + Math.random() * 255 + ")";
        this.pos = new Array(2);
    }
    //SETTER and GETTER
    setnumber(number: number) {
        this.number = number;
    }
    getnumber() {
        return this.number;
    }
    setstate(state: State) {
        this.state = state;
    }
    getstate() {
        return this.state;
    }
    setequalsTrue(equals: BooleanOrUndef) {
        this.equals = equals;
    }
    getequalsTrue() {
        return this.equals;
    }
    setpos(xpos: number, ypos: number) {
        this.pos[0] = xpos;
        this.pos[1] = ypos;
    }
    getpos() {
        return this.pos;
    }
    setColor(color: string) {
        this.color = color;
    }
    getColor() {
        return this.color;
    }
}
