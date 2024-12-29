import { Guideline, Criterion, StateWithGroup, Condition, LogicalCondition, StateCondition, CategoricalCondition, NumericalCondition, CriterionValue } from "./model";

export class CriteriaExtraction {


  /*
  extract criteria (taken from InteractiveAnalysis in the oncoliterature project 2024-08-05)
  */

  public static extractCriteria(guideline: Guideline): Criterion[] {
    const foundCriteria: Criterion[] = [];
    
    //copy criteria by priority if there is something
    if (guideline.criteriaByPriority != undefined) {
      guideline.criteriaByPriority.forEach((criterionWrapper) => foundCriteria.push(criterionWrapper.getCriterion()));
      guideline.criteriaByPriority.forEach((criterionWrapper) => criterionWrapper.getCriterion().containingStates = []);
    }

    //there may be additional criteria inside the conditions
    if (guideline.mainGroup != undefined) {
      for (let state of guideline.mainGroup.states) {
        this.appendInvolvedCriteria(state.condition, foundCriteria, new StateWithGroup(state, guideline.mainGroup));
      }
    }
    for (let sideGroup of guideline.sideGroups) {
      for (let state of sideGroup.states) {
        this.appendInvolvedCriteria(state.condition, foundCriteria, new StateWithGroup(state, sideGroup));
      }
    }
    return foundCriteria;
  }

  private static appendInvolvedCriteria(condition: Condition, appendList: Criterion[], topLevelState: StateWithGroup): void {
    if (condition instanceof LogicalCondition) {
      for (let subCondition of condition.conditions) {
        this.appendInvolvedCriteria(subCondition, appendList, topLevelState);
      }
    }
    else if (condition instanceof StateCondition) {
      //extract criteria from the condition(s) of a side state
      this.appendInvolvedCriteria(condition.state.condition, appendList, topLevelState);
    }
    else if (condition instanceof CategoricalCondition) {
      const criterion = condition.criterion;
      if (criterion != null) {
        if (!appendList.includes(criterion)) {
          appendList.push(criterion);
          criterion.containingStates = [];
        }
        if (!criterion.containingStates.includes(topLevelState)) {
          criterion.containingStates.push(topLevelState);
        }
      }
    }
    else if (condition instanceof NumericalCondition && condition.reference instanceof CriterionValue) {
      const criterion = condition.reference.criterion;
      if (criterion != null) {
        if (!appendList.includes(criterion)) {
          appendList.push(criterion);
          criterion.containingStates = [];
        }
        if (!criterion.containingStates.includes(topLevelState)) {
          criterion.containingStates.push(topLevelState);
        }
      }
    }
  }
}
