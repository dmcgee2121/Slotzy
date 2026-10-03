import assert from "node:assert/strict";
import { test } from "node:test";
import {
  areDevelopmentEndpointsEnabled,
  isProductionLikeEnvironment,
  normalizeRuntimeEnvironment,
} from "../src/runtimePolicy.js";

test("development endpoints are available only in local development and test", () => {
  assert.equal(areDevelopmentEndpointsEnabled("development"), true);
  assert.equal(areDevelopmentEndpointsEnabled("test"), true);
  assert.equal(areDevelopmentEndpointsEnabled("staging"), false);
  assert.equal(areDevelopmentEndpointsEnabled("production"), false);
});

test("staging and production are production-like runtimes", () => {
  assert.equal(isProductionLikeEnvironment("staging"), true);
  assert.equal(isProductionLikeEnvironment("production"), true);
  assert.equal(isProductionLikeEnvironment("development"), false);
  assert.equal(normalizeRuntimeEnvironment("  STAGING  "), "staging");
});
