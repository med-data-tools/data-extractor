import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { CategoricalCriterion, CriteriaValues, Criterion, DataSource, Guideline, NumericalCriterion, Range } from '../classes/model';
import { Observable, catchError, map, of, switchMap, throwError } from 'rxjs';
import { CriteriaExtraction } from '../classes/criteria-extraction';
import escapeStringRegexp from 'escape-string-regexp';


@Injectable({
  providedIn: 'root'
})
export class TextExtractionService {
  
  constructor(private http: HttpClient) { }

  public extracText(guideline: Guideline, baseUrl: string, text: string, dataSource?: DataSource): Observable<{extractedValues: CriteriaValues, reachedLLM: boolean}> {
    const criteria = CriteriaExtraction.extractCriteria(guideline);
    const requestForAllCriteria = {
      requests:[""]
    };
    // gather prompts for all criteria in requestForAllCriteria
    for(let criterion of criteria) {
      let prompt = criterion.regexRule;
      if (prompt !==undefined && prompt !== "" && prompt !==null) {
        prompt = prompt.replace("[INFO]", text);
        if(criterion instanceof CategoricalCriterion){
          let selectOptions = "";
          let options = [];
          for(let value of criterion.values){
            options.push(value.name);
          }
          options.push('unknown');
          selectOptions = "[" + options.map(item => `'${item}'`).join(", ") + "]";

          let tmp={
            'criterion': criterion.name,
            'type': 'c',
            'prompt': prompt,
            'selectOptions': selectOptions
          }
          requestForAllCriteria.requests.push(JSON.stringify(tmp));
        }
        if(criterion instanceof NumericalCriterion){
          let tmp={
            'criterion':criterion.name,
            'type':'n',
            'prompt':prompt
          }
          requestForAllCriteria.requests.push(JSON.stringify(tmp));
        }
      }
    }
    //try to send the request to the large language model (llm)
    requestForAllCriteria.requests.splice(0,1); //TODO: jz to fd: why?! please add more comments to your code ;)
    const llm = this.http.post<any>(`${baseUrl}/api`, requestForAllCriteria);

    return llm.pipe(
      switchMap(data => {
        // Success case
        console.log(data);
        const extractedCriteriaValues = new CriteriaValues();
        for (let answer of data.answers) {
          if (answer.value!=="unknown"){
            for (let criterion of criteria) {
              if(criterion.name === answer.criterion) {
                switch(answer.type) {
                  case "c": //CategoricalCriterion
                    if (criterion instanceof CategoricalCriterion) {  
                      // associatedFile[1].push([crit,[data.answers[i].value],dataSource]);
                      // associatedFile[1].loading=false;
                      // if(this.changeDetectorRef!==undefined){
                      //   this.changeDetectorRef.detectChanges();
                      // }
                      extractedCriteriaValues.addCategorical(criterion, [answer.value], dataSource ?? DataSource.TEXT);
                      // this.updateCriterionEvent.emit([crit,[data.answers[i].value],dataSource]);
                      break;
                    }
                  break;
                  case "n"://NumericalCriteriona
                    if (criterion instanceof NumericalCriterion) {
                      const value = parseFloat(answer.value);
                      // associatedFile[1].push([criterion,new Range(tmpValue,tmpValue),dataSource]);
                      // associatedFile[1].loading=false;
                      // if(this.changeDetectorRef!==undefined){
                      //   this.changeDetectorRef.detectChanges();
                      // }
                      extractedCriteriaValues.addNumerical(criterion, new Range(value, value), dataSource ?? DataSource.TEXT);
                      // this.updateCriterionEvent.emit([crit,new Range(tmpValue,tmpValue),dataSource]);
                      break;
                    }
                  break;
                }
              }
            }
          }
        }
        return of({extractedValues: extractedCriteriaValues, reachedLLM: true});
      }),
      catchError(error => {
        // Failue case; could not reach the llm -> use regex instead
        return of({extractedValues: this.regexExtraction(guideline, criteria, text, dataSource ?? DataSource.TEXT), reachedLLM: false});
      })
    );
  }



  /* data exraction via regex */
  private regexExtraction(guideline: Guideline, criteria: Criterion[], text: string, dataSource: DataSource) {
    const extractedCriteriaValues = new CriteriaValues();

    //for (X), collect all value names that occur multiple times
    const allValueNames: string[] = [];
    const doubleValueNames: string[] = [];
    for (let criterion of criteria) {
      if (criterion instanceof CategoricalCriterion) {
        for (let valueEntry of criterion.values) {
          for (let valueName of [valueEntry.name, ...(valueEntry.synonyms ?? [])]) {
            if (allValueNames.includes(valueName)) {
              doubleValueNames.push(valueName);
            }
            else {
              allValueNames.push(valueName);
            }
          }
        }
      }
    }

    //for regex, we also use some collection of words defined here; TODO: maybe extract this hard-coded lists later on
    //Note: German and English word in use
    var connectionWords: string[] = [
      ":", "=", "\\- ", "–", " ist ", " is ", " sind ", " are ", " von ", " in ", " an ", " auf ", " ca\.", " etwa ", " ungefähr ", " grob ", " genau ", " über ", " unter ", " vor ", " hinter ", " nach ", " vorher ", " nachher ", " früher ", " später ", " from ", " ca ", " roughly ", " about ", " trough ", " by ", " of ", " on ", " above ", " below ", " behind ", " before ", " after ", " later ", " earlier ", " over ", " under "
    ]
    var negationWords: string[] = [
      "ohne ", "nicht ", "kein ", "keine ", "keiner ", "keines ", "außer ", "ausser ", "ausgeschlossen ", "ausgenommen ", "bis auf ", "not ", "without ", "except ", "except for ", "ex. ", "excluding ", "excluded ", "no "
    ]
    var commonBlackListWords: string[] = [
      "ja", "nein", "vielleicht", "teilweise", "teils", "meist", "meistens", "großteils", "grossteils", "größtenteils", "grösstenteils", "vollständig", "voll", "komplett", "ganz", "klein", "gering", "geringfügig", "leicht", "schwer", "links", "rechts", "mitte", "mittig", "oben", "unten", "vor", "nach", "prä", "post", "beide", "beides", "beidseits", "beidseitig", "auf beiden Seiten", "lateral", "zentral", "medial", "median", "paramedian", "ipsilateral", "kontralateral", "parietal", "viszeral", "dorsal", "ventral", "kranial", "cranial", "kaudal", "caudal", "terminal", "ektop", "proximal", "distal", "profund", "superficial", "anterior", "posterior", "inferior", "superior", "temporal", "chronisch", "positiv", "negativ", "pos", "neg", "pos.", "neg.", "unbekannt", "unbestimmt", "unklar", "unsicher", "schwankend", "stabil", "hart", "weich", "stark", "schwach", "vorhanden", "nicht vorhanden", "da", "nicht", "dort", "nicht dort", "hier", "nicht hier", "fehlend", "lose", "los", "mobil", "frei", "fest", "fixiert", "keine",
      "yes", "no", "maybe", "perhaps", "partial", "partially", "most", "mostly", "large", "largly", "complete", "completely", "whole", "full", "fully", "small", "little", "minor", "major", "hardly", "rough", "roughly", "light", "heavy", "left", "right", "mid", "middle", "center", "central", "top", "bottom", "before", "after", "pre", "post", "both", "sides", "side", "both sides", "para median", "ipsi lateral", "contralateral", "contra lateral", "visceral", "ectop", "distal", "profound", "ant-erior", "post-erior", "in-ferior", "sup-erior", "chronic", "chronical", "positive", "negative", "unkown", "not konwn", "undetermined", "not determined", "unclear", "not clear", "clear", "sure", "unsure", "volatile", "stable", "hard", "soft", "strong", "weak", "present", "absent", "there", "not there", "here", "not here", "missing", "mobile", "fixed", "loose", "unfixed", "unmobile", "none"
    ]

    
    for (let criterion of criteria) {
      const regex = new RegExp("((?<=" + escapeStringRegexp(criterion.name) +
          "\\s*(" + connectionWords.join("|") + "|\\s(?!" + connectionWords.join("|") + "))\\s*)" +
          (criterion instanceof NumericalCriterion ? "\\-?\\d+" + (criterion.integral ? "" : "([\\.\\,]\\d*)?") : "\\S+") + ")", "i");
      const regexReverse = new RegExp("(" +
          (criterion instanceof NumericalCriterion ? "\\-?\\d+" + (criterion.integral ? "" : "([\\.\\,]\\d*)?") : "\\S+") +
          "(?=\\s*(" + connectionWords.join("|") + "|\\s(?!" + connectionWords.join("|") + "))\\s*" +
          escapeStringRegexp(criterion.name) + "))", "i");
      const occurrences = regex.exec(text) ?? regexReverse.exec(text);
      if (occurrences != undefined && occurrences.length > 0) {
        if (criterion instanceof CategoricalCriterion) {
          var foundValue = occurrences[0];
          var success = false;
          for (let valueEntry of criterion.values) {
            for (let valueName of [valueEntry.name, ...(valueEntry.synonyms ?? [])]) { //beside its name, also include its synonyms
              if (foundValue.toLowerCase() == valueName.toLowerCase()) { //adjust for small/big letter (capitalization)
                extractedCriteriaValues.addCategorical(criterion, [valueEntry.name], dataSource);
                success = true;
              }
            }
          }
          if (success) {
            continue; //find next criterion; we are done with this one (TODO in the future: extract multiple values; currently we just take the first one)
          }
        }
        else if (criterion instanceof NumericalCriterion) {
          const value = criterion.integral ? Number.parseInt(occurrences[0]) : Number.parseFloat(occurrences[0].replace(",", "."));
          extractedCriteriaValues.addNumerical(criterion, new Range(value, value, criterion.integral), dataSource);
          continue; //find next criterion; we are done with this one (TODO in the future: extract multiple values; currently we just take the first one)
        }
      }

      //last regex check: if it is a "special" categorical criteria value, then we just search for this string given these five conditions:
      // 1. this value name must not occur somewhere else
      // 2. the string has length at least 3
      // 4. must start with withespace or beginning symbol and must end with whitespace or termination symbol
      // 5. no negation word before that value
      // 6. it is not a ``common'' word (does not appear in a blacklist of common words defined here)
      // for 1. we have collected all entries with double occurrences (X)

      if (criterion instanceof CategoricalCriterion) {
        for (let valueEntry of criterion.values) {
          for (let valueName of [valueEntry.name, ...(valueEntry.synonyms ?? [])]) { //beside its name, also include its synonyms
            if (valueName.length >= 2 && !doubleValueNames.includes(valueName) && !commonBlackListWords.includes(valueName)) {
              const regex = new RegExp("((?<!(" + negationWords.join("|") + ")\\s*)(\\s|^)" + escapeStringRegexp(valueName) + "(\\s|$))", "i");
              const occurrences = regex.exec(text);
              if (occurrences != undefined && occurrences.length > 0) {
                extractedCriteriaValues.addCategorical(criterion, [valueEntry.name], dataSource);
              }
            }
          }
        }
      }
    }
    return extractedCriteriaValues;
  }

}
