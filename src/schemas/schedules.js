const { object, string, boolean } = require("yup");

module.exports.getScheduleStatusSchema = object({
  query: object({
    channel_id: string().required("'channel_id' field is required."),
  }),
});

module.exports.scheduleSyncSchema = object({
  body: object({
    service_type: string()
      .oneOf(["product", "order", "inventory"], "invalid 'service_type'.")
      .required("'service_type' field is required."),
    channel_id: string().required("'channel_id' field is required."),
    running_status: boolean().required("'running_status' field is required."),
  }),
});

module.exports.controlByChannelIdSchema = object({
  body: object({
    channel_id: string().required("'channel_id' field is required."),
    running_status: boolean().required("'running_status' field is required."),
  }),
});

module.exports.changeRunningStatus = object({
  body: object({
    running_status: boolean().required("'running_status' field is required."),
  }),
});
