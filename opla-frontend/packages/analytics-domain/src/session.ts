import { defaultRowLimit } from './ids';
import { fail, ok } from './result';
import { commitQuestion, keepQueryable } from './question';
import type {
  AnalysisApi,
  AnalysisIO,
  BoardId,
  HubPins,
  OrgId,
  OrgReports,
  ParseResult,
  ProjectAnalysis,
  ProjectId,
  QuestionId,
  SaveViewInput,
  Table,
} from './types';

function toPins(ids: readonly QuestionId[]): ParseResult<HubPins> {
  switch (ids.length) {
    case 0: {
      const next: HubPins = [];
      return ok(next);
    }
    case 1: {
      const first = ids[0];
      if (first === undefined) return fail('empty', 'pin list broke');
      const next: readonly [QuestionId] = [first];
      return ok(next);
    }
    case 2: {
      const first = ids[0];
      const second = ids[1];
      if (first === undefined || second === undefined) return fail('empty', 'pin list broke');
      const next: readonly [QuestionId, QuestionId] = [first, second];
      return ok(next);
    }
    case 3: {
      const first = ids[0];
      const second = ids[1];
      const third = ids[2];
      if (first === undefined || second === undefined || third === undefined) {
        return fail('empty', 'pin list broke');
      }
      const next: readonly [QuestionId, QuestionId, QuestionId] = [first, second, third];
      return ok(next);
    }
    case 4: {
      const first = ids[0];
      const second = ids[1];
      const third = ids[2];
      const fourth = ids[3];
      if (first === undefined || second === undefined || third === undefined || fourth === undefined) {
        return fail('empty', 'pin list broke');
      }
      const next: readonly [QuestionId, QuestionId, QuestionId, QuestionId] = [first, second, third, fourth];
      return ok(next);
    }
    default:
      return fail('pin_limit', 'at most four hub pins');
  }
}

function findTable(tables: readonly Table[], id: SaveViewInput['parent']): Table | undefined {
  return tables.find((table) => table.id === id);
}

function makeProjectAnalysis(input: {
  io: AnalysisIO;
  orgId: OrgId;
  projectId: ProjectId;
  tables: readonly Table[];
}): ProjectAnalysis {
  const { io, orgId, projectId, tables } = input;
  const defaultLimit = defaultRowLimit();

  return {
    orgId,
    projectId,
    tables,
    defaultRowLimit: defaultLimit,
    run(query) {
      return io.request({ op: 'run', query, rowPolicy: 'query_only' });
    },
    compileFormula() {
      return fail('formula_not_server', 'formula compile is not in this unit');
    },
    async saveView(viewInput) {
      const parent = findTable(tables, viewInput.parent);
      if (parent === undefined) return fail('unparseable', 'parent table is not in this project');
      const keep = keepQueryable(parent, viewInput.drop ?? []);
      if (!keep.ok) return keep;
      return ok(await io.request({ op: 'write_view', projectId, input: viewInput }));
    },
    async saveQuestion(questionInput) {
      const draft = commitQuestion({
        title: questionInput.title,
        result: questionInput.result,
        viz: questionInput.viz,
        projectId,
      });
      if (!draft.ok) return draft;
      return ok(
        await io.request({
          op: 'write_question',
          projectId,
          title: draft.value.title,
          query: draft.value.query,
          viz: draft.value.viz,
        }),
      );
    },
    async loadQuestion(id) {
      const question = await io.request({ op: 'load_question', id });
      if (question.projectId !== projectId) return fail('wrong_project', 'question belongs to another project');
      return ok(question);
    },
    listQuestions() {
      return io.request({ op: 'list_questions', projectId });
    },
    async saveBoard(draft) {
      return ok(await io.request({ op: 'write_analysis_board', projectId, draft }));
    },
    async loadBoard(id: BoardId) {
      const board = await io.request({ op: 'load_board', id });
      if (board.kind !== 'analysis') return fail('wrong_scope', 'that board is a report');
      if (board.projectId !== projectId) return fail('wrong_project', 'board belongs to another project');
      return ok(board);
    },
    listBoards() {
      return io.request({ op: 'list_analysis_boards', projectId });
    },
    pins() {
      return io.request({ op: 'load_pins', projectId });
    },
    async pin(questionId) {
      const current = await io.request({ op: 'load_pins', projectId });
      const ids: readonly QuestionId[] = current;
      if (ids.some((id) => id === questionId)) return ok(current);
      const next = toPins([...ids, questionId]);
      if (!next.ok) return next;
      return ok(await io.request({ op: 'write_pins', projectId, pins: next.value }));
    },
    async unpin(questionId) {
      const current = await io.request({ op: 'load_pins', projectId });
      const ids: readonly QuestionId[] = current;
      const next = toPins(ids.filter((id) => id !== questionId));
      if (!next.ok) {
        const empty: HubPins = [];
        return io.request({ op: 'write_pins', projectId, pins: empty });
      }
      return io.request({ op: 'write_pins', projectId, pins: next.value });
    },
  };
}

function makeOrgReports(input: { io: AnalysisIO; orgId: OrgId }): OrgReports {
  const { io, orgId } = input;
  return {
    orgId,
    listBoards() {
      return io.request({ op: 'list_report_boards', orgId });
    },
    async saveBoard(draft) {
      return ok(await io.request({ op: 'write_report_board', orgId, draft }));
    },
    async loadBoard(id) {
      const board = await io.request({ op: 'load_board', id });
      if (board.kind !== 'report') return fail('wrong_scope', 'that board is project analysis');
      if (board.orgId !== orgId) return fail('wrong_scope', 'board belongs to another org');
      return ok(board);
    },
    async place() {
      return fail('unparseable', 'report tile place needs a board update op, not in this unit');
    },
    async grant(grantInput) {
      return ok(await io.request({ op: 'write_grant', boardId: grantInput.boardId, grant: grantInput.grant }));
    },
    async publish(boardId) {
      return ok(await io.request({ op: 'publish_report', id: boardId }));
    },
    async runQuestion(id) {
      const question = await io.request({ op: 'load_question', id });
      return ok(await io.request({ op: 'run', query: question.query, rowPolicy: 'approved_capture' }));
    },
  };
}

export function createAnalysis(io: AnalysisIO): AnalysisApi {
  return {
    async openProjectAnalysis({ orgId, projectId }) {
      const tables = await io.request({ op: 'list_tables', projectId });
      return makeProjectAnalysis({ io, orgId, projectId, tables });
    },
    async openOrgReports({ orgId }) {
      return makeOrgReports({ io, orgId });
    },
  };
}
