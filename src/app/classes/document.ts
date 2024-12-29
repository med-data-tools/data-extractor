import { CriterionStatus } from "./criterion-status";
import { CriteriaValues, Criterion, Guideline, StateGroup } from "./model";
import { AbstractInferencer } from "./abstract-inferencer";
import { StateGroupStatus } from "./state-group-status";
import { Message } from "../view/input/input.component"
import { CriteriaExtraction } from "./criteria-extraction";

export class Document extends AbstractInferencer {

  mainGroupStatus?: StateGroupStatus;
  sideGroupStatuses: Map<StateGroup, StateGroupStatus> = new Map();
  private criteriaValues: CriteriaValues;
  private criterionStatuses: Map<Criterion, CriterionStatus>;
  criteria: Criterion[];
  files: {file: File, values: CriteriaValues}[] = []; //ADDED BY FABIO
  chat: Message[]; //ADDED BY FABIO


  constructor(
    public id: number,
    public title: string,
    public createdDate: Date,
    public guideline: Guideline
  ) {
    super();
    this.chat = [];
    if (guideline.mainGroup != undefined) {
      this.mainGroupStatus = new StateGroupStatus(guideline.mainGroup, false, guideline, this);
    }
    for (let sideGroup of guideline.sideGroups) {
      this.sideGroupStatuses.set(sideGroup, new StateGroupStatus(sideGroup, false, guideline, this));
    }
    this.criteriaValues = new CriteriaValues();
    this.criterionStatuses = new Map();
    this.criteria = CriteriaExtraction.extractCriteria(guideline);
    for (let criterion of this.criteria) {
      this.criterionStatuses.set(criterion, new CriterionStatus(criterion, guideline, this));
    }
  }

  public setCriteriaValues(values: CriteriaValues) {
    this.criteriaValues = values;
    this.updateStateGroups();
  }
  
  public override getCriteriaValues(): CriteriaValues {
    return this.criteriaValues;
  }
  public override getAllCriterionQueries(): Iterable<CriterionStatus> {
    return this.criterionStatuses.values();
  }
  protected override updateObjectsAfterCriterionChanged(criterion: Criterion): void {
    this.updateStateGroups();
  }
  // public override findKnowledgeEntityReferences(element?: HTMLElement | undefined): void {
  //   throw new Error("Method not implemented.");
  // }

  private updateStateGroups(): void {
    if (this.mainGroupStatus != undefined) {
      this.mainGroupStatus.updateStateGroup(this.criteriaValues);
    }
    if (this.sideGroupStatuses != undefined) {
      for (let sideGroupStatus of this.sideGroupStatuses.values()) {
        sideGroupStatus.updateStateGroup(this.criteriaValues);
      }
    }
  }





  public emptyDocument(): void {
    this.title = '';
    this.files = [];
    this.chat = [];
  }
    
}
