export class Constants {
  //static readonly PATH_DEMO_GUIDELINE = "../../assets/guidelines/KSSG SOP(10).json"
  static readonly PATH_DEMO_GUIDELINES: string[] = [
    "../../assets/guidelines/demo-guideline-open-source.json"
  ];
  static readonly START_GUIDELINE_INDEX = 0;
  static readonly DEFAULT_FILE_TEXT_EXTRACTION_URL = "https://med.run.place";
  static readonly DEFAULT_LLM_URL = "http://localhost:8080";

  static readonly ROUNDING_DECIMAL_PRECISION = 2;
  static readonly CRITERION_DEFAULT_MIN = 0;
  static readonly CRITERION_DEFAULT_MAX = 999;

  static readonly STRING_FOR_UNKNOWN = "unknown";
  static readonly STRING_FOR_UNDEFINED_CRITERION_VALUE = "-- unknown --";
  static readonly STRING_FOR_ONE_IN_ARRAY_CRITERION_VALUE = "one of ";
  static readonly STRING_TIME = "Time";
  static readonly STRING_SOURCE = "Source";
  static readonly STRING_ENTRY_CREATED = "Entry created";
  static readonly STRING_NO_TIME = "unknown";


  static readonly MAX_UPDATE_ROUNDS_CRITERIA_VALUES = 10;

  static readonly DEFAULT_TIME_OF_INSERTED_CRITERION = "12:00";
  static readonly CRITERION_SHORT_DESCRIPTION_MAX_LENGTH = 30;
}
