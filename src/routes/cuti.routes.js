const express = require("express");
const router = express.Router();

const { auth } = require("../middlewares/auth.middleware");
const { 
  createCuti,
  listMyCuti,
  approveCuti,
  rejectCuti
} = require("../controllers/cuti.controller");

// USER ajukan cuti
router.post("/", auth, createCuti);

// USER lihat cuti miliknya
router.get("/", auth, listMyCuti);

// ADMIN menyetujui cuti
router.put("/:id/approve", auth, approveCuti);

// ADMIN menolak cuti
router.put("/:id/reject", auth, rejectCuti);

module.exports = router;
