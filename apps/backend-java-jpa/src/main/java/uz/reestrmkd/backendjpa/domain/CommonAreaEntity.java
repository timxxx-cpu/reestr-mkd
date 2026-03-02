package uz.reestrmkd.backendjpa.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@Entity
@Table(name = "common_areas")
public class CommonAreaEntity extends BaseEntity {

    @Column(name = "floor_id", nullable = false)
    private String floorId;

    @Column(name = "entrance_id")
    private String entranceId;

    @Column(name = "type")
    private String type;

    @Column(name = "area")
    private BigDecimal area;

    @Column(name = "height")
    private BigDecimal height;
}