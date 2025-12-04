const express = require("express");
const router = express.Router();

const { auth,permit } = require("../middlewares/auth.middleware");
const { 
  createCuti,
  listMyCuti,
  listAllCuti,
  approveCuti,
  rejectCuti
} = require("../controllers/cuti.controller");

// USER ajukan cuti
router.post("/", auth, createCuti);

// USER lihat cuti miliknya
router.get("/", auth, listMyCuti);

// ADMIN lihat semua cuti (Route Baru)
router.get("/all", auth, permit("ADMIN"), listAllCuti);

// ADMIN menyetujui cuti
router.put("/:id/approve", auth, approveCuti);

// ADMIN menolak cuti
router.put("/:id/reject", auth, rejectCuti);

module.exports = router;
