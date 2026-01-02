import axios from "axios";
import fs from "fs";

const VNDB_API = "https://api.vndb.org/kana/vn";

async function fetchVN() {
    const response = await axios.post(
        VNDB_API,
        {
            filters: [],
            fields: "id,title,alttitle,description,tags.name",
            results: 10
        },
        {
            headers: {
                "Content-Type": "application/json"
            }
        }
    );

    return response.data.results;
}

async function main() {
    console.log("Fetching VN data from VNDB...");

    const vns = await fetchVN();

    fs.writeFileSync(
        "vns_raw.json",
        JSON.stringify(vns, null, 2),
        "utf-8"
    );

    console.log(`Saved ${vns.length} VNs to vns_raw.json`);
}

main().catch(err => console.error(err));
