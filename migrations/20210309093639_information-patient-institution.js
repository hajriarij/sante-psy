/* eslint-disable func-names */
const dbPatients = require('../db/patients')

exports.up = function(knex) {
  return knex.schema.table(dbPatients.patientsTable, function (table) {
    table.text('institutionName');
    table.boolean('isStudentStatusVerified');
    table.boolean('hasPrescription');
  })
};

exports.down = function(knex) {
  return knex.schema.table(dbPatients.patientsTable, function (table) {
    table.dropColumn('institutionName');
    table.dropColumn('isStudentStatusVerified');
    table.dropColumn('hasPrescription');
  })
};
