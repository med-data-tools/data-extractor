import { State, StateGroup, Guideline, Criterion, CriteriaValues, BooleanOrUndef, StateConfirmation } from "./model";
import { AbstractInferencer } from "./abstract-inferencer";


export class StateGroupStatus {
  public possibleStatesByPriority: State[] = [];
  public possibleStates: State[] = [];
  public confirmedStates: State[] = [];
  public minimized: boolean = false;

  constructor(public group: StateGroup, public isSideGroup: boolean, public guideline: Guideline, public parent: AbstractInferencer) {

  }

  public updateStateGroup(criteriaValues: CriteriaValues) {

    //TODO: for performance only reset arrays of the class instance if they really change
    const possibleStatesByPriority = [];
    const confirmedStates = [];
    //TODO: currently it is not checked whether group.statesByPriority contains all states of group.states
    // or just a subset. If it is just a subset, then the evaluation will not work correctly.
    // we may catch this case by checking which states are not contained in group.statesByPriority and add them to the end.
    const statesByPriority: State[] = this.group.statesByPriority == null ? this.group.states : this.group.statesByPriority;
    for (let state of statesByPriority) {
      const evalResult: BooleanOrUndef = state.condition.evaluate(criteriaValues);
      if (evalResult == BooleanOrUndef.TRUE || evalResult == BooleanOrUndef.UNDEFINED) {
        possibleStatesByPriority.push(state);
        //check if the current state is true;
        //only if this one is true AND there is no other state with higher priority being undefined, we confirm it
        //in any case, we can abort because lower priority states will not "overrule" this state which is already true
        if (evalResult == BooleanOrUndef.TRUE) {
          if (this.group.stateConfirmation == StateConfirmation.STRICT_BY_PRIORITY) {
            if (possibleStatesByPriority.length == 1) {
              confirmedStates.push(state);
            }
            break;
          }
          else if (this.group.stateConfirmation == StateConfirmation.CURRENTLY_CONFIRMED) {
            confirmedStates.push(state);
            break;
          }
          else if (this.group.stateConfirmation == StateConfirmation.ALL_CONFIRMED) {
            confirmedStates.push(state);
          }
        }
        //otherwise there may be multiple possible states that can become true given more information
        //we have already added them to the array of possible states
      }
    }


    //update arrays only if something has changed
    if (!this.arraysContainSameElements(possibleStatesByPriority, this.possibleStates) || !this.arraysContainSameElements(confirmedStates, this.confirmedStates)) {

      this.resetStatesAndTheirConfirmations();

      //update arrays
      this.possibleStatesByPriority = possibleStatesByPriority;
      this.confirmedStates = confirmedStates;

      //it remains to sort the possible states by display order instead of priority order
      this.possibleStates = [];
      for (let state of this.group.states) {
        if (this.possibleStatesByPriority.includes(state)) {
          this.possibleStates.push(state);
        }
      }
      //... also the confirmed states
      if (this.confirmedStates.length > 1 && this.group.stateConfirmation == StateConfirmation.ALL_CONFIRMED) {
        const confirmedStatesCopy = this.confirmedStates;
        this.confirmedStates = [];
        for (let state of this.group.states) {
          if (confirmedStatesCopy.includes(state)) {
            this.confirmedStates.push(state);
          }
        }
      }
    }
  }

  private arraysContainSameElements(array0: any[], array1: any[]) {
    if (array0.length === array1.length) {
      return array0.every(element => {
        if (array1.includes(element)) {
          return true;
        }
        return false;
      });
    }
    return false;
  }
  
  private resetStatesAndTheirConfirmations() {
    this.confirmedStates = [];
    this.possibleStatesByPriority = [];
  }

  public relevantForHighestPrioState(criterion: Criterion): boolean {
    if (this.possibleStatesByPriority.length == 0) {
      return false;
    }
    let currentHightestPrioState = this.possibleStatesByPriority[0];
    if (currentHightestPrioState.condition.dependsOnCriterion(criterion, this.parent.getCriteriaValues())) {
      return true;
    }
    return false;
  }

  public relevantForAnyPossibleState(criterion: Criterion): boolean {
    return StateGroupStatus.relevantForAState(this.possibleStatesByPriority, criterion, this.parent.getCriteriaValues());
  }
  
  public relevantForConfirmedStates(criterion: Criterion): boolean {
    return StateGroupStatus.relevantForAState(this.confirmedStates, criterion, this.parent.getCriteriaValues());
  }

  public relevantForAnyState(criterion: Criterion): boolean {
    return StateGroupStatus.relevantForAState(this.group.states, criterion, this.parent.getCriteriaValues());
  }

  private static relevantForAState(states: State[], criterion: Criterion, criteriaValues: CriteriaValues): boolean {
    for (let state of states) {
      if (state.condition.dependsOnCriterion(criterion, criteriaValues)) {
        return true;
      }
      if (state.numerical != undefined && state.numerical.getDependingCriteria(criteriaValues).includes(criterion)) {
        return true;
      }
    }
    return false;
  }
}
