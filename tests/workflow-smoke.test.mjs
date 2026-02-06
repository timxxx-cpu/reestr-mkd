import test from 'node:test';
import assert from 'node:assert/strict';

import { APP_STATUS } from '../src/lib/constants.js';
import {
    getCompletionTransition,
    getRollbackTransition,
    getReviewTransition
} from '../src/lib/workflow-state-machine.js';

const base = {
    status: APP_STATUS.DRAFT,
    currentStage: 1,
    currentStepIndex: 0
};

test('complete step: regular transition increments step and keeps DRAFT', () => {
    const t = getCompletionTransition(base, 0);
    assert.equal(t.nextStepIndex, 1);
    assert.equal(t.nextStatus, APP_STATUS.DRAFT);
    assert.equal(t.isStageBoundary, false);
});

test('complete step: stage boundary moves to REVIEW', () => {
    const t = getCompletionTransition(base, 5);
    assert.equal(t.isStageBoundary, true);
    assert.equal(t.nextStatus, APP_STATUS.REVIEW);
    assert.equal(t.nextStage, 2);
});

test('complete step: boundary before integration keeps REVIEW status', () => {
    const t = getCompletionTransition({ ...base, currentStage: 3 }, 11);
    assert.equal(t.nextStepIndex, 12);
    assert.equal(t.nextStatus, APP_STATUS.REVIEW);
    assert.equal(t.isIntegrationStart, true);
});

test('complete step: last step closes project', () => {
    const t = getCompletionTransition({ ...base, currentStage: 4 }, 16);
    assert.equal(t.isLastStepGlobal, true);
    assert.equal(t.nextStatus, APP_STATUS.COMPLETED);
});

test('rollback from REVIEW returns to DRAFT and previous step', () => {
    const t = getRollbackTransition({
        status: APP_STATUS.REVIEW,
        currentStage: 2,
        currentStepIndex: 8
    });

    assert.equal(t.prevIndex, 7);
    assert.equal(t.nextStatus, APP_STATUS.DRAFT);
});

test('review approve keeps workflow moving from REVIEW to DRAFT', () => {
    const t = getReviewTransition({
        status: APP_STATUS.REVIEW,
        currentStage: 2,
        currentStepIndex: 6
    }, 'APPROVE');

    assert.equal(t.isApprove, true);
    assert.equal(t.nextStatus, APP_STATUS.DRAFT);
    assert.equal(t.nextStepIndex, 6);
});

test('review reject returns to previous stage and status REJECTED', () => {
    const t = getReviewTransition({
        status: APP_STATUS.REVIEW,
        currentStage: 3,
        currentStepIndex: 10
    }, 'REJECT');

    assert.equal(t.isApprove, false);
    assert.equal(t.nextStatus, APP_STATUS.REJECTED);
    assert.equal(t.nextStage, 2);
    assert.equal(t.nextStepIndex, 8);
});
