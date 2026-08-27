import axios from "axios";

const API = axios.create({
    baseURL: "https://smartbilling-api-het.onrender.com/api"
});

export default API;