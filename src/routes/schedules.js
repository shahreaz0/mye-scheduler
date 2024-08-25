const router = require("express").Router();
const { ToadScheduler, SimpleIntervalJob, AsyncTask } = require("toad-scheduler");
const axios = require("axios").default;
const log = require("../logger");

// scheduler instance
const scheduler = new ToadScheduler();

// models
const Schedule = require("../models/Schedule");

// middlewares
const validateRequest = require("../middlewares/validate-request");

// schemas
const {
  getScheduleStatusSchema,
  scheduleSyncSchema,
  controlByChannelIdSchema,
  changeRunningStatus,
} = require("../schemas/schedules");

const init = async () => {
  console.log("init()");
  try {
    // find all schedules
    const schedules = await Schedule.find();

    // start all the schedules
    schedules.forEach((schedule) => {
      // create task
      const task = new AsyncTask("simple task", async () => {
        const { status, statusText, data } = await axios.get(schedule.endpoint);

        console.log({
          status,
          statusText,
          data,
          schedulerDetails: schedule,
        });
      });

      // create job
      const job = new SimpleIntervalJob(
        { seconds: schedule.timer, runImmediately: false },
        task,
        schedule._id
      );

      // add and start the job
      scheduler.addSimpleIntervalJob(job);

      if (schedule.active_status === "stopped") scheduler.stopById(schedule._id);
    });
  } catch (error) {
    log.error(error);
  }
};

// set schedules in the memory when server restarts
init();

/**
 * ===================
 * Routes
 * ===================
 *
 */

// @route   PUT /api/schedules/query
// @desc    update schedule by query
// @access  public
router.put("/query", validateRequest(changeRunningStatus), async (req, res) => {
  try {
    let query = Schedule.find();

    if (req.body.active_status) {
      query = query.find({ active_status: req.body.active_status });
    }

    if (req.body._id) {
      query = query.find({ _id: req.body._id });
    }

    if (req.body.timer) {
      query = query.find({ timer: req.body.timer });
    }

    if (req.body.type) {
      query = query.find({ type: req.body.type });
    }

    if (req.body.channel_id) {
      query = query.find({ channel_id: req.body.channel_id });
    }

    if (req.body.channel_name) {
      query = query.find({ channel_name: req.body.channel_name });
    }

    const schedules = await query.find();

    if (!schedules.length) return res.send({ message: "No Schedules" });

    if (req.body.running_status) {
      const promises = schedules.map((schedule) => {
        scheduler.startById(schedule._id);

        schedule.active_status = "running";
        return schedule.save();
      });

      const ress = await Promise.all(promises);

      return res.send({ status: "success", data: ress });
    } else {
      const promises = schedules.map((schedule) => {
        scheduler.stopById(schedule._id);

        schedule.active_status = "stopped";
        return schedule.save();
      });

      const ress = await Promise.all(promises);

      return res.send({ status: "success", data: ress });
    }

    // res.send({ schedules });
  } catch (error) {
    log.error(error);
    res.status(500).send({ error: error.message });
  }
});

// @route   GET /api/schedules
// @desc    get all schedules
// @access  public
router.get("/", async (req, res) => {
  try {
    // find all schedules
    let query = Schedule.find();

    // field selection
    if (req.query.fields) {
      if (/^\w+(,\w+)*$/.test(req.query.fields)) {
        const params = req.query.fields
          .split(",")
          .map((e) => e.trim())
          .join(" ");

        query = query.select(`-_id ${params}`);
      } else {
        return res
          .status(400)
          .send({ message: "Give proper comma separated value. No space is allowed" });
      }
    }

    if (req.query.active_status) {
      query = query.find({ active_status: req.query.active_status });
    }

    if (req.query.timer) {
      query = query.find({ timer: +req.query.timer });
    }

    if (req.query.type) {
      query = query.find({ type: req.query.type });
    }

    if (req.query.channel_id) {
      query = query.find({ channel_id: req.query.channel_id });
    }

    if (req.query.channel_name) {
      query = query.find({ channel_name: req.query.channel_name });
    }

    const schedules = await query.find();

    if (!schedules.length) return res.send({ message: "No Schedules" });

    // send response all schedules
    res.send({ status: "success", data: schedules });
  } catch (error) {
    log.error(error);
    res.status(500).send({ error: error.message });
  }
});

// @route   POST /api/schedules
// @desc    add schedule
// @access  public
router.post("/", async (req, res) => {
  try {
    // destructure all the values from body
    const { channel_name, channel_id, endpoint, timer, active_status, type } = req.body;

    // create schedules and save in the db
    const schedule = new Schedule({
      channel_id,
      channel_name,
      endpoint,
      timer,
      active_status,
      type,
    });

    await schedule.save();

    // create task
    const task = new AsyncTask("simple task", async () => {
      const { status, statusText, headers, data } = await axios.get(schedule.endpoint);

      console.log({
        status,
        statusText,
        data,
        schedulerDetails: schedule,
      });
    });

    // create job
    const job = new SimpleIntervalJob(
      { seconds: schedule.timer, runImmediately: true },
      task,
      schedule._id
    );

    // add and start the schedule
    scheduler.addSimpleIntervalJob(job);

    // send response
    res
      .status(201)
      .send({ message: "The schedule successfully created", data: schedule });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// @route   PUT /api/schedules/:id
// @desc    update schedules by ID
// @access  public
router.put("/:id", async (req, res) => {
  try {
    // destructure all the values from body
    const { channel_name, channel_id, endpoint, timer, type, running_status } = req.body;

    // find schedule by id
    const schedule = await Schedule.findById(req.params.id);

    if (!schedule) return res.send({ message: "No schedule found with this ID" });

    // remove old schedule
    scheduler.removeById(req.params.id);

    // updating the schedule with new data
    schedule.channel_id = channel_id || schedule.channel_id;
    schedule.channel_name = channel_name || schedule.channel_name;
    schedule.endpoint = endpoint || schedule.endpoint;
    schedule.timer = timer || schedule.timer;
    schedule.type = type || schedule.type;

    const task = new AsyncTask("simple task", async () => {
      const { status, statusText, data } = await axios.get(schedule.endpoint);

      console.log({
        status,
        statusText,
        data,
        schedulerDetails: schedule,
      });
    });

    if (running_status === true && schedule.active_status === "stopped") {
      schedule.active_status = "running";

      const job = new SimpleIntervalJob({ seconds: schedule.timer }, task, schedule._id);

      scheduler.addSimpleIntervalJob(job);
      await schedule.save();
      return res.send({ message: "Schedule successfully updated", data: schedule });
    }

    if (running_status === false && schedule.active_status === "running") {
      schedule.active_status = "stopped";

      const job = new SimpleIntervalJob({ seconds: schedule.timer }, task, schedule._id);

      scheduler.addSimpleIntervalJob(job);
      scheduler.stopById(schedule._id);
      await schedule.save();
      return res.send({ message: "Schedule successfully updated", data: schedule });
    }

    // save it to the db
    await schedule.save();
    // create new job
    const job = new SimpleIntervalJob({ seconds: schedule.timer }, task, schedule._id);

    // add and start the new job
    scheduler.addSimpleIntervalJob(job);
    if (schedule.active_status === "stopped") scheduler.stopById(schedule._id);

    // send response
    res.send({ message: "Schedule successfully updated", data: schedule });
  } catch (error) {
    res.status(500).send({ error });
  }
});

// @route   GET /api/schedules/start/:id
// @desc    start schedules by ID
// @access  public
router.get("/start/:id", async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id);

    if (!schedule) return res.send({ message: "No schedule found with this ID" });

    // if active status is not stopped, send response
    if (schedule.active_status !== "stopped")
      return res.send({ message: "This schedule is already running" });

    // if stopped then,

    // start schedule by id
    scheduler.startById(req.params.id);

    schedule.active_status = "running";

    await schedule.save();

    res.send({ message: "The schedule is successfully running" });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// @route   GET /api/schedules/stop/:id
// @desc    stop schedules by ID
// @access  public
router.get("/stop/:id", async (req, res) => {
  try {
    // find schedules by id
    const schedule = await Schedule.findById(req.params.id);

    if (!schedule) return res.send({ message: "No schedule found with this ID" });

    // if active status is not running, send proper response
    if (schedule.active_status !== "running")
      return res.send({ message: "This schedule is already stopped" });

    // if running then,

    // stop schedule by id
    scheduler.stopById(req.params.id);

    schedule.active_status = "stopped";

    await schedule.save();

    res.send({ message: "The schedule is successfully stopped" });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// @route   GET /api/schedules/start
// @desc    starts all schedules
// @access  public
router.get("/start", async (_req, res) => {
  try {
    //find all schedules
    const schedules = await Schedule.find();

    // check if there are any schedules or not
    if (schedules.length === 0)
      return res.send({
        message: "There is no schedule to start",
      });

    // starts all the schedules
    schedules.forEach((schedule) => {
      scheduler.getById(schedule._id).start();
    });

    // update the status
    await Schedule.updateMany({ active_status: "stopped" }, { active_status: "running" });

    // res final response
    res.send({ message: "Started all schedules" });
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: error.message });
  }
});

// @route   GET /api/schedules/stop
// @desc    stops all schedules
// @access  public
router.get("/stop", async (_req, res) => {
  try {
    //stops all schedules
    scheduler.stop();

    // update the status
    await Schedule.updateMany({ active_status: "running" }, { active_status: "stopped" });

    // send response
    res.send({ message: "Stopped all schedules" });
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: error.message });
  }
});

// @route   PUT /api/schedules/start/:channel_id
// @desc    start all schedules by Channel ID
// @access  public
router.put("/channels/start/:channel_id", async (req, res) => {
  try {
    // find schedules by id
    let schedules = await Schedule.find({
      channel_id: req.params.channel_id,
      active_status: "stopped",
    });

    if (schedules.length === 0)
      return res.send({ message: "No schedules found with this channel ID" });

    schedules.forEach((schedule) => {
      scheduler.startById(schedule._id);
    });

    const ress = await Schedule.updateMany(
      {
        channel_id: req.params.channel_id,
        active_status: "stopped",
      },
      { $set: { active_status: "running" } }
    );

    res.json(ress);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// @route   PUT /api/schedules/stop/:channel_id
// @desc    stop all schedules by Channel ID
// @access  public
router.put("/channels/stop/:channel_id", async (req, res) => {
  try {
    // find schedules by id
    let schedules = await Schedule.find({
      channel_id: req.params.channel_id,
      active_status: "running",
    });

    if (schedules.length === 0)
      return res.send({ message: "No schedules found with this channel ID" });

    schedules.forEach((schedule) => {
      scheduler.stopById(schedule._id);
    });

    const ress = await Schedule.updateMany(
      {
        channel_id: req.params.channel_id,
        active_status: "running",
      },
      { $set: { active_status: "stopped" } }
    );

    res.json(ress);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

router.put(
  "/channels/control",
  validateRequest(controlByChannelIdSchema),
  async (req, res) => {
    try {
      // find schedules by id
      let schedules = await Schedule.find({
        channel_id: req.body.channel_id,
      });

      if (schedules.length === 0)
        return res
          .status(400)
          .send({ message: "No schedules found with this channel ID" });

      if (req.body.running_status) {
        schedules.forEach((schedule) => {
          if (schedule.active_status === "stopped") scheduler.startById(schedule._id);
        });

        const ress = await Schedule.updateMany(
          {
            channel_id: req.body.channel_id,
            active_status: "stopped",
          },
          { $set: { active_status: "running" } },
          { new: true }
        );

        return res.json({ message: "All schedules successfully started", data: ress });
      } else {
        schedules.forEach((schedule) => {
          if (schedule.active_status === "running") scheduler.stopById(schedule._id);
        });

        const ress = await Schedule.updateMany(
          {
            channel_id: req.body.channel_id,
            active_status: "running",
          },
          { $set: { active_status: "stopped" } },
          { new: true }
        );

        return res.json({ message: "All schedules successfully stopped", data: ress });
      }
    } catch (error) {
      log.error(error);
      res.status(500).send({ error: error.message });
    }
  }
);

// @route   PUT /api/schedules/channels/sync
// @desc    start/stop schedules by Channel ID and service type
// @access  public
router.put("/channels/sync", validateRequest(scheduleSyncSchema), async (req, res) => {
  try {
    const schedule = await Schedule.findOne({
      channel_id: req.body.channel_id,
      type: req.body.service_type,
    });

    if (!schedule) return res.status(400).json({ message: "No schedules found" });

    if (req.body.running_status) {
      if (schedule.active_status !== "stopped")
        return res.status(400).json({ message: "This schedule is already running" });
      schedule.active_status = "running";
      scheduler.startById(schedule._id);
    } else {
      if (schedule.active_status !== "running")
        return res.status(400).json({ message: "This schedule is already stopped" });

      schedule.active_status = "stopped";
      scheduler.stopById(schedule._id);
    }

    await schedule.save();

    res.json({ message: "Successfully updated", data: schedule });
  } catch (error) {
    log.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// @route   GET /api/schedules/status?channel_id=ss
// @desc    start schedules by Channel ID
// @access  public
router.get("/status", validateRequest(getScheduleStatusSchema), async (req, res) => {
  const schedules = await Schedule.find({
    channel_id: req.query.channel_id,
  });

  if (schedules.length === 0) return res.json({ message: "No schedules found" });

  const resp = {};

  schedules.forEach((schedule) => {
    if (schedule.type === "order") resp.order_sync = schedule.active_status === "running";
    if (schedule.type === "product")
      resp.product_sync = schedule.active_status === "running";
  });

  res.json(resp);
});

// @route   DELETE /api/schedules/:id
// @desc    remove schedules by ID
// @access  public
router.delete("/:id", async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id);

    if (!schedule) return res.send({ message: "no schedule found with this ID" });

    // remove the job
    scheduler.removeById(req.params.id);

    await Schedule.deleteOne({ _id: req.params.id }, { new: true });

    res.send({ message: "This schedule is successfully deleted" });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

module.exports = router;
