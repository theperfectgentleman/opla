# Analytics domain usage

The public contract is one small `analytics` module. It lets Studio build a query once, preview the server answer, save a question with a renderable view, place that question on an Analysis dashboard, and publish the same question to an org Report.

```ts
import {
  analysis,
  arithmetic,
  chart,
  field,
  metric,
  table,
} from '@opla/analytics';

const question = analysis.question({
  title: 'Visits by district',
  source: analysis.dataset('dataset-123'),
  query: analysis.query({
    source: 'dataset-123',
    select: [field('district')],
    metrics: [metric.count({ as: 'visits' })],
    groupBy: [field('district')],
    orderBy: [{ expression: metric.ref('visits'), direction: 'desc' }],
    limit: 50,
  }),
  view: chart.bar({
    category: field('district'),
    value: metric.ref('visits'),
  }),
});

const preview = await analysis.execute(question.query);
await analysis.save(question);
```

The caller never sends `Record<string, unknown>` into the domain. HTTP and database JSON are parsed once before these calls. A query result is the only data source for a chart or a dashboard card.

## Dataset table in Project Data

The Analysis route asks for a dataset, then keeps the table and its saved question separate from Design forms.

```tsx
const source = await analytics.sources.get({
  orgId,
  projectId,
  datasetId,
});

const tableQuestion = analysis.question({
  title: `${source.name} table`,
  source: analysis.dataset(source.id),
  query: analysis.query({
    source: source.id,
    select: source.fields
      .filter((column) => column.type !== 'geo_shape')
      .map((column) => field(column.key)),
    calculated: [
      analysis.derivedColumn({
        key: 'value_per_visit',
        expression: arithmetic.divide(field('total_value'), metric.countRows()),
      }),
    ],
    limit: 100,
  }),
  view: table({
    columns: source.fields.map((column) => field(column.key)),
  }),
});

const result = await analytics.query.preview(tableQuestion.query);
await analytics.questions.save(tableQuestion);
```

`analysis.derivedColumn` is a query expression, not a new Form. If the user saves a prepared table, the server stores a `DerivedTable` and its re-runnable query definition. The form catalog is never touched.

## One query for builder and dashboard

The builder renders the response returned by the same execution endpoint that a dashboard uses later.

```ts
const question = await analytics.questions.get(questionId);
const builderResult = await analytics.query.execute(question.query);

const dashboard = await analytics.dashboards.addCard(dashboardId, {
  questionId: question.id,
  view: question.view,
});

const dashboardResult = await analytics.query.execute(question.query);
assert.equal(builderResult.columns, dashboardResult.columns);
```

The client may format or paginate the returned rows. It may not aggregate a separate local answer for a saved chart.

## Live GPS map on an Analysis dashboard

Maps use a declared geo field from the selected dataset. Demo coordinates and static areas are not a valid source.

```ts
const mapQuestion = analysis.question({
  title: 'Coverage by capture location',
  source: analysis.dataset(datasetId),
  query: analysis.query({
    source: datasetId,
    select: [field('project_area'), field('capture_location')],
    metrics: [metric.count({ as: 'records' })],
    groupBy: [field('project_area')],
  }),
  view: analysis.map({
    location: field('capture_location'),
    colorBy: field('project_area'),
    tooltip: [field('project_area'), metric.ref('records')],
  }),
});

await analytics.questions.save(mapQuestion);
await analytics.dashboards.addCard(dashboardId, {
  questionId: mapQuestion.id,
  view: mapQuestion.view,
});
```

## Share a question through Reports

Reports are org boards with server-side Team grants. They are not browser-local copies of Analysis dashboards.

```ts
const report = await analytics.reports.create({
  orgId,
  title: 'Weekly field coverage',
});

await analytics.reports.addQuestion(report.id, {
  questionId: questionId,
  layout: { x: 0, y: 0, width: 6, height: 4 },
});

await analytics.reports.grant(report.id, {
  teamId,
  role: 'viewer',
});
```

Graphic Walker can continue to consume a preview query as an Explore scratchpad. It is not a persisted dashboard or Report view.
