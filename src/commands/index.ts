import type { Command } from "./types.js";
import { task } from "./task.js";
import { expense } from "./expense.js";
import { spending } from "./spending.js";
import { shop } from "./shop.js";
import { remind } from "./remind.js";
import { standing } from "./standing.js";
import { lookup } from "./lookup.js";
import { status } from "./status.js";
import { note } from "./note.js";
import { golive } from "./sandbox.js";
import { test } from "./test.js";
import { guide } from "./guide.js";
import { ready } from "./ready.js";
import { help } from "./help.js";

export const commands: Command[] = [
  task,
  expense,
  spending,
  shop,
  remind,
  standing,
  lookup,
  status,
  note,
  golive,
  test,
  guide,
  ready,
  help,
];
