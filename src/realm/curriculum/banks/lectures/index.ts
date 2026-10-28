/** Every subject with ready-made lectures (see types.ts). */

import type { SubjectLectures } from "./types";
import { CSE2UI_LECTURES } from "./cse2ui";
import { CSE3CWA_LECTURES } from "./cse3cwa";
import { PM_LECTURES } from "./projectManagement";
import { PPE_LECTURES } from "./professionalPractice";

export const LECTURE_BANKS: SubjectLectures[] = [CSE2UI_LECTURES, CSE3CWA_LECTURES, PM_LECTURES, PPE_LECTURES];
